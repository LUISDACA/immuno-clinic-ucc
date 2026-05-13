"""Repository for admin student reports and exports."""

from dataclasses import dataclass

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.common.enums import Role, VaccineStatus
from app.modules.users.models import Profile, User
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccines.models import Vaccine


@dataclass(frozen=True)
class StudentReportFilters:
    search: str | None = None
    is_active: bool | None = None
    program: str | None = None
    campus: str | None = None
    sex: str | None = None
    semester: int | None = None
    vaccination_status: str | None = None


class AdminStudentReportRepository:
    """Data access for admin-only student list and export read models."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_students(
        self,
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
        filters = StudentReportFilters(
            search=search,
            is_active=is_active,
            program=program,
            campus=campus,
            sex=sex,
            semester=semester,
            vaccination_status=vaccination_status,
        )
        query = (
            select(User)
            .join(Profile)
            .options(joinedload(User.profile), selectinload(User.student_vaccines))
            .where(User.role == Role.STUDENT)
        )
        count_query = select(func.count(User.id)).join(Profile).where(User.role == Role.STUDENT)

        query = self._apply_student_filters(query, filters)
        count_query = self._apply_student_filters(count_query, filters)
        query = self._apply_vaccination_status_filter(query, filters.vaccination_status)
        count_query = self._apply_vaccination_status_filter(
            count_query,
            filters.vaccination_status,
        )

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        result = await self.db.execute(
            query.order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
        users = result.unique().scalars().all()
        return list(users), total

    async def get_all_students_for_export(
        self,
        search: str | None = None,
        is_active: bool | None = None,
        program: str | None = None,
        campus: str | None = None,
        sex: str | None = None,
        semester: int | None = None,
    ) -> list[User]:
        filters = StudentReportFilters(
            search=search,
            is_active=is_active,
            program=program,
            campus=campus,
            sex=sex,
            semester=semester,
        )
        query = (
            select(User)
            .join(Profile)
            .options(
                joinedload(User.profile),
                selectinload(User.student_vaccines).joinedload(StudentVaccine.vaccine),
                selectinload(User.student_vaccines)
                .selectinload(StudentVaccine.doses)
                .joinedload(StudentVaccineDose.dose_config),
            )
            .where(User.role == Role.STUDENT)
        )

        query = self._apply_student_filters(query, filters)

        result = await self.db.execute(query.order_by(User.created_at.desc()))
        return list(result.unique().scalars().all())

    async def get_statistics(
        self,
        program: str | None = None,
        campus: str | None = None,
        semester: int | None = None,
    ) -> dict:
        filters = StudentReportFilters(
            program=program,
            campus=campus,
            semester=semester,
        )
        student_query = select(User).join(Profile).where(User.role == Role.STUDENT)
        student_query = self._apply_student_filters(
            student_query,
            filters,
            include_search=False,
            include_active=False,
            include_sex=False,
        )

        total_stmt = select(func.count()).select_from(student_query.subquery())
        total_result = await self.db.execute(total_stmt)
        total_students = total_result.scalar_one()

        active_stmt = select(func.count()).select_from(
            student_query.where(User.is_active.is_(True)).subquery()
        )
        active_result = await self.db.execute(active_stmt)
        active_students = active_result.scalar_one()
        inactive_students = total_students - active_students

        sex_stmt = (
            select(Profile.sex, func.count(User.id))
            .join(User)
            .where(User.role == Role.STUDENT)
            .group_by(Profile.sex)
        )
        sex_stmt = self._apply_student_filters(
            sex_stmt,
            filters,
            include_search=False,
            include_active=False,
            include_sex=False,
        )
        sex_result = await self.db.execute(sex_stmt)
        by_sex = {
            row[0].value if hasattr(row[0], "value") else str(row[0]): row[1]
            for row in sex_result.all()
        }

        compliant_subq = (
            select(StudentVaccine.user_id)
            .group_by(StudentVaccine.user_id)
            .having(
                func.sum(case((StudentVaccine.status != VaccineStatus.APPROVED, 1), else_=0)) == 0
            )
        ).subquery()

        comp_stmt = (
            select(func.count(User.id))
            .join(Profile)
            .join(compliant_subq, User.id == compliant_subq.c.user_id)
            .where(User.role == Role.STUDENT)
        )
        comp_stmt = self._apply_student_filters(
            comp_stmt,
            filters,
            include_search=False,
            include_active=False,
            include_sex=False,
        )

        comp_result = await self.db.execute(comp_stmt)
        compliant_students = comp_result.scalar_one()
        pending_students = total_students - compliant_students

        campus_stmt = (
            select(Profile.campus, func.count(User.id))
            .join(User)
            .where(User.role == Role.STUDENT, Profile.campus.isnot(None))
            .group_by(Profile.campus)
        )
        campus_stmt = self._apply_student_filters(
            campus_stmt, filters, include_search=False, include_active=False, include_sex=False
        )
        campus_result = await self.db.execute(campus_stmt)
        by_campus = {str(row[0]): row[1] for row in campus_result.all() if row[0]}

        program_stmt = (
            select(Profile.program, func.count(User.id))
            .join(User)
            .where(User.role == Role.STUDENT, Profile.program.isnot(None))
            .group_by(Profile.program)
        )
        program_stmt = self._apply_student_filters(
            program_stmt, filters, include_search=False, include_active=False, include_sex=False
        )
        program_result = await self.db.execute(program_stmt)
        by_program = {str(row[0]): row[1] for row in program_result.all() if row[0]}

        vaccine_stmt = (
            select(
                Vaccine.id,
                Vaccine.name,
                Vaccine.code,
                func.sum(case((StudentVaccine.status == VaccineStatus.APPROVED, 1), else_=0)),
                func.sum(case((StudentVaccine.status == VaccineStatus.PENDING, 1), else_=0)),
                func.sum(case((StudentVaccine.status == VaccineStatus.DENIED, 1), else_=0)),
                func.sum(case((StudentVaccine.status == VaccineStatus.IN_REVIEW, 1), else_=0)),
                func.count(StudentVaccine.id),
            )
            .select_from(StudentVaccine)
            .join(Vaccine, StudentVaccine.vaccine_id == Vaccine.id)
            .join(User, StudentVaccine.user_id == User.id)
            .join(Profile, Profile.user_id == User.id)
            .where(User.role == Role.STUDENT)
            .group_by(Vaccine.id, Vaccine.name, Vaccine.code, Vaccine.display_order)
            .order_by(Vaccine.display_order, Vaccine.name)
        )
        vaccine_stmt = self._apply_student_filters(
            vaccine_stmt,
            filters,
            include_search=False,
            include_active=False,
            include_sex=False,
        )
        vaccine_result = await self.db.execute(vaccine_stmt)
        vaccine_compliance = [
            {
                "vaccine_id": row[0],
                "name": row[1],
                "code": row[2],
                "up_to_date": row[3] or 0,
                "pending": row[4] or 0,
                "denied": row[5] or 0,
                "in_review": row[6] or 0,
                "total": row[7] or 0,
            }
            for row in vaccine_result.all()
        ]

        return {
            "total_students": total_students,
            "active_students": active_students,
            "inactive_students": inactive_students,
            "by_sex": by_sex,
            "by_campus": by_campus,
            "by_program": by_program,
            "vaccination_status": {
                "approved": compliant_students,
                "pending": pending_students,
            },
            "vaccine_compliance": vaccine_compliance,
        }

    def _apply_student_filters(
        self,
        query,
        filters: StudentReportFilters,
        include_search: bool = True,
        include_active: bool = True,
        include_sex: bool = True,
    ):
        if include_active and filters.is_active is not None:
            query = query.where(User.is_active == filters.is_active)

        if include_search and filters.search:
            query = query.where(self._student_search_filter(filters.search))

        if filters.program:
            query = query.where(Profile.program == filters.program)

        if filters.campus:
            query = query.where(Profile.campus == filters.campus)

        if include_sex and filters.sex:
            query = query.where(Profile.sex == filters.sex)

        if filters.semester is not None:
            query = query.where(Profile.semester == filters.semester)

        return query

    def _apply_vaccination_status_filter(self, query, vaccination_status: str | None):
        if not vaccination_status:
            return query

        approved_students_subq = (
            select(StudentVaccine.user_id)
            .group_by(StudentVaccine.user_id)
            .having(func.every(StudentVaccine.status == VaccineStatus.APPROVED))
        )

        if vaccination_status == VaccineStatus.APPROVED.value:
            return query.where(User.id.in_(approved_students_subq))
        if vaccination_status == VaccineStatus.PENDING.value:
            return query.where(User.id.not_in(approved_students_subq))
        return query

    def _student_search_filter(self, search: str):
        return or_(
            User.email.ilike(f"%{search}%"),
            Profile.first_name.ilike(f"%{search}%"),
            Profile.last_name.ilike(f"%{search}%"),
            Profile.document_number.ilike(f"%{search}%"),
            Profile.student_id.ilike(f"%{search}%"),
        )
