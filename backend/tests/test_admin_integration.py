"""Integration tests for admin student operations."""

import json
from pathlib import Path

import pytest
import pytest_asyncio
from app.common.enums import DoseStatus, DoseType, Gender, Role
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.modules.admin.schemas import (
    CreateStudentRequest,
    UpdateStudentProfileRequest,
    VaccineCreateRequest,
    VaccineDoseConfigInput,
)
from app.modules.admin.students.service import StudentAdminService
from app.modules.admin.vaccines.service import VaccineCatalogService
from app.modules.audit.service import AuditService
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.models import (
    StudentSchemeVersion,
    StudentVaccine,
    StudentVaccineDose,
)
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T02_PROFILE_CASES = json.loads(
    (Path(__file__).parent / "fixtures" / "t02_profile_changes.json").read_text(encoding="utf-8")
)["cases"]


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
        from app.core.security import verify_password

        assert len(sent_emails) == 1
        email, context = sent_emails[0]
        assert email == student.email
        assert context["full_name"] == "Carlos García"
        assert context["temporary_password"] != data.document_number
        assert verify_password(context["temporary_password"], student.hashed_password)
        assert not verify_password(data.document_number, student.hashed_password)

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
    async def test_profile_update_preserves_legacy_semester_but_rejects_new_out_of_range_value(
        self,
        db: AsyncSession,
        student_admin_service: StudentAdminService,
        admin_user: User,
        student_user: User,
    ):
        student = await student_admin_service.get_student_detail(admin_user, student_user.id)
        assert student.profile is not None
        student.profile.semester = 12
        await db.commit()

        await student_admin_service.update_student_profile(
            admin_user,
            student.id,
            UpdateStudentProfileRequest(semester=12),
        )
        with pytest.raises(BadRequestException):
            await student_admin_service.update_student_profile(
                admin_user,
                student.id,
                UpdateStudentProfileRequest(semester=11),
            )

    @pytest.mark.asyncio
    async def test_authorized_profile_change_versions_scheme_without_deleting_history(
        self,
        db: AsyncSession,
        student_admin_service: StudentAdminService,
        admin_user: User,
        student_user: User,
    ):
        scheme_service = student_admin_service.scheme_service
        catalog = VaccineCatalogService(db, scheme_service, student_admin_service.audit)
        vaccine = await catalog.create_vaccine(
            admin_user,
            VaccineCreateRequest(
                name="Vacuna por sexo",
                code="PROFILE_VERSION",
                applies_to="female",
                dose_configs=[VaccineDoseConfigInput(dose_number=1, label="Dosis 1")],
            ),
        )
        assignment = await db.scalar(
            select(StudentVaccine).where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
            )
        )
        dose = await db.scalar(
            select(StudentVaccineDose).where(StudentVaccineDose.student_vaccine_id == assignment.id)
        )
        original_dose_id = dose.id
        dose.status = DoseStatus.APPROVED
        await db.commit()

        await student_admin_service.update_student_profile(
            admin_user,
            student_user.id,
            UpdateStudentProfileRequest(
                sex=Gender.MALE,
                program="Enfermería",
                campus="Bogotá",
            ),
        )

        versions = list(
            (
                await db.scalars(
                    select(StudentSchemeVersion)
                    .where(StudentSchemeVersion.user_id == student_user.id)
                    .order_by(StudentSchemeVersion.version_number)
                )
            ).all()
        )
        assert [version.reason for version in versions[-2:]] == [
            "profile:reconciliation:before",
            "profile:reconciliation:after",
        ]
        before = versions[-2].snapshot
        after = versions[-1].snapshot
        assert before["profile"] == {
            "sex": Gender.FEMALE.value,
            "program": "Medicina",
            "campus": "Principal",
        }
        assert after["profile"] == {
            "sex": Gender.MALE.value,
            "program": "Enfermería",
            "campus": "Bogotá",
        }
        assert before["vaccines"][0]["doses"][0]["status"] == DoseStatus.APPROVED.value
        assert after["vaccines"] == []

        historical_dose = await db.get(StudentVaccineDose, original_dose_id)
        historical_assignment = await db.get(StudentVaccine, assignment.id)
        assert historical_dose is not None and historical_dose.is_active is False
        assert historical_assignment is not None and historical_assignment.is_active is False
        assert historical_dose.status == DoseStatus.APPROVED

    @pytest.mark.asyncio
    @pytest.mark.parametrize("case", T02_PROFILE_CASES, ids=lambda case: case["id"])
    async def test_each_profile_reconciliation_preserves_snapshot_and_clinical_history(
        self,
        case,
        db: AsyncSession,
        student_admin_service: StudentAdminService,
        admin_user: User,
        student_user: User,
    ):
        """Synthetic T-02 rehearsal: profile trigger creates v2 without rewriting v1."""
        from datetime import date, datetime, timezone

        catalog = VaccineCatalogService(
            db,
            student_admin_service.scheme_service,
            student_admin_service.audit,
        )
        vaccine = await catalog.create_vaccine(
            admin_user,
            VaccineCreateRequest(
                name="Synthetic history vaccine",
                code=f"T02_{case['id'].replace('-', '_').upper()}",
                applies_to="all",
                dose_configs=[
                    VaccineDoseConfigInput(dose_number=1, label="Applied dose"),
                    VaccineDoseConfigInput(
                        dose_number=2,
                        label="Titer",
                        is_required=False,
                        dose_type=DoseType.TITER,
                    ),
                ],
            ),
        )
        assignment = await db.scalar(
            select(StudentVaccine).where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
            )
        )
        doses = list(
            (
                await db.scalars(
                    select(StudentVaccineDose)
                    .where(StudentVaccineDose.student_vaccine_id == assignment.id)
                    .order_by(StudentVaccineDose.dose_number)
                )
            ).all()
        )
        original_assignment_status = assignment.status.value
        reviewed_at = datetime(2025, 4, 5, 12, 30, tzinfo=timezone.utc)
        doses[0].status = DoseStatus.APPROVED
        doses[0].applied_date = date(2025, 4, 4)
        doses[0].admin_notes = "synthetic reviewed dose"
        doses[0].reviewed_by = admin_user.id
        doses[0].reviewed_at = reviewed_at
        doses[1].status = DoseStatus.APPROVED
        doses[1].titer_value = "synthetic-positive"
        doses[1].admin_notes = "synthetic titer review"
        doses[1].reviewed_by = admin_user.id
        doses[1].reviewed_at = reviewed_at
        await db.commit()

        update = {case["field"]: case["to"]}
        await student_admin_service.update_student_profile(
            admin_user,
            student_user.id,
            UpdateStudentProfileRequest(**update),
        )

        versions = list(
            (
                await db.scalars(
                    select(StudentSchemeVersion)
                    .where(StudentSchemeVersion.user_id == student_user.id)
                    .order_by(StudentSchemeVersion.version_number)
                )
            ).all()
        )
        before, after = versions[-2:]
        old_snapshot = before.snapshot
        new_snapshot = after.snapshot
        assert before.reason == "profile:reconciliation:before"
        assert after.reason == "profile:reconciliation:after"
        assert old_snapshot["profile"][case["field"]] == case["from"]
        assert new_snapshot["profile"][case["field"]] == case["to"]
        assert old_snapshot["vaccines"][0]["status"] == original_assignment_status
        assert old_snapshot["vaccines"][0]["doses"][0]["applied_date"] == "2025-04-04"
        assert old_snapshot["vaccines"][0]["doses"][0]["reviewed_by"] == str(admin_user.id)
        assert old_snapshot["vaccines"][0]["doses"][0]["reviewed_at"] is not None
        assert old_snapshot["vaccines"][0]["doses"][1]["titer_value"] == "synthetic-positive"
        assert new_snapshot["vaccines"][0]["doses"] == old_snapshot["vaccines"][0]["doses"]
        await db.refresh(assignment)
        assert new_snapshot["vaccines"][0]["status"] == assignment.status.value

        # Re-read the saved v1 row to prove the reconciliation did not rewrite it.
        await db.refresh(before)
        assert before.snapshot == old_snapshot
        persisted_doses = list(
            (
                await db.scalars(
                    select(StudentVaccineDose)
                    .where(StudentVaccineDose.student_vaccine_id == assignment.id)
                    .order_by(StudentVaccineDose.dose_number)
                )
            ).all()
        )
        assert len(persisted_doses) == 2
        assert persisted_doses[0].status == DoseStatus.APPROVED
        assert persisted_doses[0].applied_date == date(2025, 4, 4)
        assert persisted_doses[0].reviewed_by == admin_user.id
        assert persisted_doses[1].titer_value == "synthetic-positive"
        assert persisted_doses[1].reviewed_by == admin_user.id

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
