"""Integration tests for admin student operations."""

import pytest
import pytest_asyncio
from app.common.enums import Gender, Role
from app.core.exceptions import ConflictException, NotFoundException
from app.modules.admin.schemas import CreateStudentRequest
from app.modules.admin.students.service import StudentAdminService
from app.modules.audit.service import AuditService
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService
from sqlalchemy.ext.asyncio import AsyncSession


@pytest_asyncio.fixture
def student_admin_service(db: AsyncSession) -> StudentAdminService:
    user_repo = UserRepository(db)
    scheme_service = SchemeService(SchemeRepository(db), VaccineRepository(db))
    audit = AuditService(db)
    notifications = NotificationService(NotificationRepository(db))
    return StudentAdminService(db, user_repo, scheme_service, audit, notifications)


class TestStudentCreation:
    """Tests for admin student creation workflows."""

    @pytest.mark.asyncio
    async def test_create_student_success(
        self,
        student_admin_service: StudentAdminService,
        admin_user: User,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Creating a student with valid data succeeds."""
        sent_emails = []

        async def fake_account_email(email: str, **context):
            sent_emails.append((email, context))

        monkeypatch.setattr(
            "app.modules.admin.students.service.send_account_created_email",
            fake_account_email,
        )

        data = CreateStudentRequest(
            email="new_student@test.com",
            password="TempPass123!",
            first_name="Carlos",
            last_name="García",
            document_number="99887766",
            sex=Gender.MALE,
        )
        student = await student_admin_service.create_student(admin_user, data)
        assert student is not None
        assert student.email == "new_student@test.com"
        assert student.role == Role.STUDENT
        assert student.is_active is True
        assert student.must_change_password is True
        assert sent_emails == [
            (
                "new_student@test.com",
                {
                    "full_name": "Carlos García",
                    "temporary_password": "99887766",
                },
            )
        ]

    @pytest.mark.asyncio
    async def test_create_duplicate_email_fails(
        self,
        student_admin_service: StudentAdminService,
        admin_user: User,
    ):
        """Creating two students with the same email raises ConflictException."""
        data = CreateStudentRequest(
            email="duplicate@test.com",
            password="TempPass123!",
            first_name="Carlos",
            last_name="García",
            document_number="11223344",
            sex=Gender.MALE,
        )
        await student_admin_service.create_student(admin_user, data)

        data2 = CreateStudentRequest(
            email="duplicate@test.com",
            password="TempPass123!",
            first_name="Another",
            last_name="User",
            document_number="55667788",
            sex=Gender.FEMALE,
        )
        with pytest.raises(ConflictException):
            await student_admin_service.create_student(admin_user, data2)

    @pytest.mark.asyncio
    async def test_create_duplicate_document_fails(
        self,
        student_admin_service: StudentAdminService,
        admin_user: User,
    ):
        """Creating two students with the same document number raises ConflictException."""
        data = CreateStudentRequest(
            email="student_a@test.com",
            password="TempPass123!",
            first_name="Carlos",
            last_name="García",
            document_number="SAME_DOC_123",
            sex=Gender.MALE,
        )
        await student_admin_service.create_student(admin_user, data)

        data2 = CreateStudentRequest(
            email="student_b@test.com",
            password="TempPass123!",
            first_name="Another",
            last_name="User",
            document_number="SAME_DOC_123",
            sex=Gender.FEMALE,
        )
        with pytest.raises(ConflictException):
            await student_admin_service.create_student(admin_user, data2)


class TestStudentLifecycle:
    """Tests for activate/deactivate workflows."""

    @pytest.mark.asyncio
    async def test_deactivate_active_student(
        self,
        student_admin_service: StudentAdminService,
        admin_user: User,
        student_user: User,
    ):
        """Deactivating an active student sets is_active to False."""
        result = await student_admin_service.deactivate_student(admin_user, student_user.id)
        assert result.is_active is False

    @pytest.mark.asyncio
    async def test_reactivate_inactive_student(
        self,
        db: AsyncSession,
        student_admin_service: StudentAdminService,
        admin_user: User,
        student_user: User,
    ):
        """Reactivating a deactivated student sets is_active to True."""
        student_user.is_active = False
        await db.commit()

        result = await student_admin_service.reactivate_student(admin_user, student_user.id)
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_get_nonexistent_student_fails(
        self,
        student_admin_service: StudentAdminService,
        admin_user: User,
    ):
        """Accessing a non-existent student raises NotFoundException."""
        import uuid

        with pytest.raises(NotFoundException):
            await student_admin_service.get_student_detail(admin_user, uuid.uuid4())

    @pytest.mark.asyncio
    async def test_delete_student_cascades_and_removes_files(
        self,
        db: AsyncSession,
        student_admin_service: StudentAdminService,
        admin_user: User,
        student_user: User,
    ):
        """Hard-deleting a student removes the user, cascades related rows,
        triggers storage delete for each evidence file, and audits the action."""
        from datetime import datetime, timezone

        from app.modules.audit.models import AuditLog
        from app.modules.evidence.models import EvidenceBatch, EvidenceFile
        from app.modules.users.models import User as UserModel
        from app.storage.base import StorageService
        from sqlalchemy import select

        batch = EvidenceBatch(user_id=student_user.id, notes="set up")
        db.add(batch)
        await db.flush()
        db.add(
            EvidenceFile(
                batch_id=batch.id,
                original_filename="evidencia.pdf",
                stored_path="2026/05/abc.pdf",
                file_size=1024,
                mime_type="application/pdf",
                uploaded_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

        deleted_paths: list[str] = []

        class FakeStorage(StorageService):
            async def upload(self, file_data, filename, content_type):
                return ""

            async def get_url(self, stored_path):
                return stored_path

            async def delete(self, stored_path):
                deleted_paths.append(stored_path)

            async def download(self, stored_path):
                return b""

        await student_admin_service.delete_student(admin_user, student_user.id, FakeStorage())

        assert deleted_paths == ["2026/05/abc.pdf"]

        result = await db.execute(select(UserModel).where(UserModel.id == student_user.id))
        assert result.scalar_one_or_none() is None

        result = await db.execute(
            select(EvidenceBatch).where(EvidenceBatch.user_id == student_user.id)
        )
        assert result.scalar_one_or_none() is None

        result = await db.execute(select(AuditLog).where(AuditLog.action == "student.deleted"))
        entry = result.scalar_one()
        assert entry.actor_id == admin_user.id
        assert entry.target_id == student_user.id
        assert entry.details["evidence_files_removed"] == 1
        assert entry.details["snapshot"]["email"] == student_user.email
