"""Integration tests for admin statistics — by_campus and by_program breakdowns."""

import uuid

import pytest
from app.common.enums import Gender, Role
from app.core.security import hash_password
from app.modules.admin.reports.repository import AdminStudentReportRepository
from app.modules.users.models import Profile, User
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_student(
    db: AsyncSession,
    *,
    email: str,
    campus: str | None = None,
    program: str | None = None,
    sex: Gender = Gender.MALE,
) -> User:
    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password("Pass123!"),
        role=Role.STUDENT,
        is_active=True,
    )
    profile = Profile(
        user_id=user.id,
        first_name="Test",
        last_name="User",
        sex=sex,
        campus=campus,
        program=program,
    )
    db.add(user)
    db.add(profile)
    await db.commit()
    return user


class TestStatisticsByCampus:
    @pytest.mark.asyncio
    async def test_by_campus_groups_students(self, db: AsyncSession):
        await _create_student(db, email="s1@t.com", campus="Campus Norte")
        await _create_student(db, email="s2@t.com", campus="Campus Norte")
        await _create_student(db, email="s3@t.com", campus="Campus Sur")

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert stats["by_campus"]["Campus Norte"] == 2
        assert stats["by_campus"]["Campus Sur"] == 1

    @pytest.mark.asyncio
    async def test_students_without_campus_excluded(self, db: AsyncSession):
        await _create_student(db, email="s1@t.com", campus="Campus A")
        await _create_student(db, email="s2@t.com", campus=None)  # no campus

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert "Campus A" in stats["by_campus"]
        assert None not in stats["by_campus"]
        assert "" not in stats["by_campus"]


class TestStatisticsByProgram:
    @pytest.mark.asyncio
    async def test_by_program_groups_students(self, db: AsyncSession):
        await _create_student(db, email="s1@t.com", program="Medicina")
        await _create_student(db, email="s2@t.com", program="Medicina")
        await _create_student(db, email="s3@t.com", program="Enfermería")

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert stats["by_program"]["Medicina"] == 2
        assert stats["by_program"]["Enfermería"] == 1

    @pytest.mark.asyncio
    async def test_students_without_program_excluded(self, db: AsyncSession):
        await _create_student(db, email="s1@t.com", program="Medicina")
        await _create_student(db, email="s2@t.com", program=None)

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert "Medicina" in stats["by_program"]
        assert len([v for v in stats["by_program"].values()]) >= 1


class TestStatisticsResponse:
    @pytest.mark.asyncio
    async def test_response_includes_both_breakdown_keys(self, db: AsyncSession):
        await _create_student(db, email="s1@t.com", campus="Norte", program="Medicina")

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert "by_campus" in stats
        assert "by_program" in stats

    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_breakdowns(self, db: AsyncSession):
        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert stats["by_campus"] == {}
        assert stats["by_program"] == {}
        assert stats["total_students"] == 0

    @pytest.mark.asyncio
    async def test_sex_distribution_still_present(self, db: AsyncSession):
        await _create_student(db, email="m@t.com", sex=Gender.MALE)
        await _create_student(db, email="f@t.com", sex=Gender.FEMALE)

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert "by_sex" in stats
        total_sex = sum(stats["by_sex"].values())
        assert total_sex == 2

    @pytest.mark.asyncio
    async def test_total_counts_are_consistent(self, db: AsyncSession):
        await _create_student(db, email="s1@t.com")
        await _create_student(db, email="s2@t.com")

        repo = AdminStudentReportRepository(db)
        stats = await repo.get_statistics()

        assert stats["total_students"] == 2
        assert stats["active_students"] + stats["inactive_students"] == stats["total_students"]
