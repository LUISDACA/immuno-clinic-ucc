"""Administrative report queries and CSV rendering."""

from __future__ import annotations

import asyncio

from cachetools import TTLCache

from app.common.access import is_app_admin, require_admin_scope
from app.core.exceptions import ForbiddenException
from app.modules.admin.reports.exporter import StudentCsvExporter
from app.modules.admin.reports.repository import AdminStudentReportRepository
from app.modules.users.models import User

# Process-wide cache for admin statistics.
# Keyed by (program, campus, semester); TTL of 60 seconds means dashboards
# reflect changes within a minute while protecting the DB from repeated
# aggregations during traffic spikes.
_STATISTICS_CACHE: TTLCache = TTLCache(maxsize=256, ttl=60)
_STATISTICS_LOCK = asyncio.Lock()


class AdminReportService:
    """Read-side operations for admin dashboards and student exports."""

    def __init__(
        self,
        student_reports: AdminStudentReportRepository,
        student_csv_exporter: StudentCsvExporter | None = None,
    ):
        self.student_reports = student_reports
        self.student_csv_exporter = student_csv_exporter or StudentCsvExporter()

    def _scoped_filters(
        self,
        admin: User,
        program: str | None = None,
        campus: str | None = None,
    ) -> tuple[str | None, str | None]:
        if is_app_admin(admin):
            return program, campus
        scope_program, scope_campus = require_admin_scope(admin)
        if program is not None and program != scope_program:
            raise ForbiddenException("No puedes consultar otro programa")
        if campus is not None and campus != scope_campus:
            raise ForbiddenException("No puedes consultar otro campus")
        return scope_program, scope_campus

    async def list_students(
        self,
        admin: User,
        search: str | None = None,
        is_active: bool | None = None,
        program: str | None = None,
        campus: str | None = None,
        sex: str | None = None,
        semester: int | None = None,
        vaccination_status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        program, campus = self._scoped_filters(admin, program, campus)
        return await self.student_reports.list_students(
            search=search,
            is_active=is_active,
            program=program,
            campus=campus,
            sex=sex,
            semester=semester,
            vaccination_status=vaccination_status,
            offset=offset,
            limit=limit,
        )

    async def get_statistics(
        self,
        admin: User,
        semester: int | None = None,
    ) -> dict:
        program, campus = self._scoped_filters(admin)
        cache_key = (program, campus, semester)

        cached = _STATISTICS_CACHE.get(cache_key)
        if cached is not None:
            return cached

        async with _STATISTICS_LOCK:
            # Double-check pattern: another coroutine may have populated the
            # cache while we were waiting on the lock.
            cached = _STATISTICS_CACHE.get(cache_key)
            if cached is not None:
                return cached

            result = await self.student_reports.get_statistics(
                program=program,
                campus=campus,
                semester=semester,
            )
            _STATISTICS_CACHE[cache_key] = result
            return result

    async def export_students_csv(
        self,
        admin: User,
        search: str | None = None,
        is_active: bool | None = None,
        program: str | None = None,
        campus: str | None = None,
        sex: str | None = None,
        semester: int | None = None,
    ) -> str:
        program, campus = self._scoped_filters(admin, program, campus)
        students = await self.student_reports.get_all_students_for_export(
            search=search,
            is_active=is_active,
            program=program,
            campus=campus,
            sex=sex,
            semester=semester,
        )
        return self.student_csv_exporter.export(students)
