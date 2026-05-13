"""Administrative report queries and CSV rendering."""

from __future__ import annotations

from app.common.access import is_app_admin, require_admin_scope
from app.core.exceptions import ForbiddenException
from app.modules.admin.reports.exporter import StudentCsvExporter
from app.modules.admin.reports.repository import AdminStudentReportRepository
from app.modules.users.models import User


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
        return await self.student_reports.get_statistics(
            program=program,
            campus=campus,
            semester=semester,
        )

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
