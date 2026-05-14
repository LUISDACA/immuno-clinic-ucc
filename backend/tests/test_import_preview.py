"""Integration tests for the student import preview feature."""

import csv
import io
import uuid
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from app.common.enums import Gender, Role
from app.core.security import hash_password
from app.modules.admin.import_students.service import AdminStudentImportService
from app.modules.users.models import Profile, User
from sqlalchemy.ext.asyncio import AsyncSession


def _make_csv_upload(*rows, filename: str = "students.csv"):
    """Return a mock UploadFile backed by CSV bytes."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    for row in rows:
        writer.writerow(row)
    content = buf.getvalue().encode("utf-8")

    mock = AsyncMock()
    mock.filename = filename
    mock.content_type = "text/csv"
    mock.read = AsyncMock(return_value=content)
    return mock


class _FakeDeps:
    """Minimal stand-in for AdminDependencies exposing only what preview needs."""

    def __init__(self, db: AsyncSession):
        self.db = db


@pytest_asyncio.fixture
async def existing_student(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="already@exists.edu",
        hashed_password=hash_password("Pass123!"),
        role=Role.STUDENT,
        is_active=True,
    )
    profile = Profile(
        user_id=user.id,
        first_name="Existing",
        last_name="Student",
        sex=Gender.FEMALE,
    )
    db.add(user)
    db.add(profile)
    await db.commit()
    return user


class TestImportPreview:
    @pytest.mark.asyncio
    async def test_new_students_predicted_as_will_create(self, db: AsyncSession):
        service = AdminStudentImportService(_FakeDeps(db))
        upload = _make_csv_upload(
            ["correo institucional", "cedula", "nombre", "apellido", "sexo"],
            ["new1@test.edu", "11111111", "Ana", "Torres", "F"],
            ["new2@test.edu", "22222222", "Luis", "Gomez", "M"],
        )
        result = await service.preview_import(upload)

        assert result.will_create == 2
        assert result.will_skip == 0
        assert result.errors == 0
        assert result.total_rows == 2

    @pytest.mark.asyncio
    async def test_existing_email_predicted_as_will_skip(
        self, db: AsyncSession, existing_student: User
    ):
        service = AdminStudentImportService(_FakeDeps(db))
        upload = _make_csv_upload(
            ["correo institucional", "cedula", "nombre", "apellido", "sexo"],
            [existing_student.email, "99999999", "Existing", "Student", "F"],
            ["brand_new@test.edu", "88888888", "Nuevo", "Alumno", "M"],
        )
        result = await service.preview_import(upload)

        assert result.will_skip == 1
        assert result.will_create == 1
        skip_row = next(r for r in result.rows if r.predicted_status == "will_skip")
        assert skip_row.email == existing_student.email

    @pytest.mark.asyncio
    async def test_invalid_row_predicted_as_error(self, db: AsyncSession):
        service = AdminStudentImportService(_FakeDeps(db))
        upload = _make_csv_upload(
            ["correo institucional", "cedula", "nombre", "apellido", "sexo"],
            ["", "12345678", "Sin", "Correo", "M"],
            ["valid@test.edu", "45678901", "Con", "Correo", "F"],
        )
        result = await service.preview_import(upload)

        assert result.errors == 1
        assert result.will_create == 1

    @pytest.mark.asyncio
    async def test_preview_does_not_create_users(self, db: AsyncSession):
        from app.modules.users.models import User as UserModel
        from sqlalchemy import func, select

        before = (await db.execute(select(func.count()).select_from(UserModel))).scalar_one()

        service = AdminStudentImportService(_FakeDeps(db))
        upload = _make_csv_upload(
            ["correo institucional", "cedula", "nombre", "apellido", "sexo"],
            ["newperson@test.edu", "77777777", "Juan", "Nadie", "M"],
        )
        await service.preview_import(upload)

        after = (await db.execute(select(func.count()).select_from(UserModel))).scalar_one()
        assert after == before, "preview_import must not write users to the database"

    @pytest.mark.asyncio
    async def test_empty_file_returns_zero_counts(self, db: AsyncSession):
        service = AdminStudentImportService(_FakeDeps(db))
        upload = _make_csv_upload(filename="empty.csv")  # no rows at all
        result = await service.preview_import(upload)

        assert result.total_rows == 0
        assert result.will_create == 0

    @pytest.mark.asyncio
    async def test_preview_row_includes_name(self, db: AsyncSession):
        service = AdminStudentImportService(_FakeDeps(db))
        upload = _make_csv_upload(
            ["correo institucional", "cedula", "nombre", "apellido", "sexo"],
            ["maria@test.edu", "32132132", "Maria", "Lopez", "F"],
        )
        result = await service.preview_import(upload)

        assert result.will_create == 1
        row = result.rows[0]
        assert row.name is not None
        assert "Maria" in row.name
