"""Evidence-to-dose decisions require transactional PostgreSQL behavior."""

import asyncio
import io
import uuid

import pytest
from app.common.enums import DoseStatus, EvidenceBatchStatus, EvidenceReviewStatus
from app.modules.admin.schemas import VaccineCreateRequest, VaccineDoseConfigInput
from app.modules.admin.vaccines.service import VaccineCatalogService
from app.modules.audit.service import AuditService
from app.modules.evidence.models import EvidenceBatch
from app.modules.evidence.repository import EvidenceRepository
from app.modules.evidence.schemas import EvidenceReviewRequest
from app.modules.evidence.service import EvidenceService
from app.modules.users.models import User
from app.modules.vaccination_scheme.models import StudentVaccineDose
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy.ext.asyncio import async_sessionmaker


def _pdf() -> bytes:
    result = io.BytesIO()
    canvas = Canvas(result)
    canvas.drawString(50, 700, "Synthetic evidence")
    canvas.save()
    return result.getvalue()


async def _login(client, username: str) -> dict[str, str]:
    result = await client.post(
        "/api/v1/auth/login",
        json={"email": f"{username}@example.com", "password": "SyntheticOnly123!"},
    )
    assert result.status_code == 200
    return {"Authorization": f"Bearer {result.json()['access_token']}"}


async def _create_dose(integration_engine, integration_accounts) -> str:
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        admin = await db.get(User, integration_accounts["app_admin"])
        scheme_service = SchemeService(SchemeRepository(db), VaccineRepository(db))
        await VaccineCatalogService(db, scheme_service, AuditService(db)).create_vaccine(
            admin,
            VaccineCreateRequest(
                name="Synthetic linked evidence vaccine",
                code=f"LINK_{uuid.uuid4().hex[:10].upper()}",
                dose_configs=[VaccineDoseConfigInput(dose_number=1, label="Dose one")],
            ),
        )
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        vaccines = await SchemeRepository(db).get_student_vaccines(integration_accounts["student"])
        assert vaccines and vaccines[0].doses
        return str(vaccines[0].doses[0].id)


@pytest.mark.asyncio
async def test_denied_evidence_does_not_approve_linked_dose(
    integration_client, integration_engine, integration_accounts
):
    dose_id = await _create_dose(integration_engine, integration_accounts)
    student = await _login(integration_client, "student")
    admin = await _login(integration_client, "admin")
    initial_scheme = await integration_client.get("/api/v1/scheme/", headers=student)
    initial_dose_status = next(
        dose["status"]
        for vaccine in initial_scheme.json()["vaccines"]
        for dose in vaccine["doses"]
        if dose["id"] == dose_id
    )
    upload = await integration_client.post(
        "/api/v1/evidence/upload",
        headers=student,
        files={"files": ("synthetic.pdf", _pdf(), "application/pdf")},
        data={"dose_id": dose_id},
    )
    assert upload.status_code == 200
    assert upload.json()["status"] == "in_review"
    assert upload.json()["dose_id"] == dose_id

    denied = await integration_client.patch(
        f"/api/v1/evidence/batches/{upload.json()['id']}/review",
        headers=admin,
        json={"status": "denied"},
    )
    assert denied.status_code == 200
    assert denied.json()["status"] == "denied"
    scheme = await integration_client.get("/api/v1/scheme/", headers=student)
    dose = next(
        dose
        for vaccine in scheme.json()["vaccines"]
        for dose in vaccine["doses"]
        if dose["id"] == dose_id
    )
    assert dose["status"] == initial_dose_status
    assert dose["status"] != "approved"


@pytest.mark.asyncio
async def test_two_concurrent_approvals_commit_evidence_and_dose_once(
    integration_client, integration_engine, integration_accounts
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("Concurrent row-lock verification requires PostgreSQL")
    dose_id = await _create_dose(integration_engine, integration_accounts)
    student = await _login(integration_client, "student")
    admin = await _login(integration_client, "admin")
    upload = await integration_client.post(
        "/api/v1/evidence/upload",
        headers=student,
        files={"files": ("synthetic.pdf", _pdf(), "application/pdf")},
        data={"dose_id": dose_id},
    )
    assert upload.status_code == 200

    path = f"/api/v1/evidence/batches/{upload.json()['id']}/review"
    responses = await asyncio.wait_for(
        asyncio.gather(
            integration_client.patch(path, headers=admin, json={"status": "approved"}),
            integration_client.patch(path, headers=admin, json={"status": "approved"}),
        ),
        timeout=10,
    )
    assert [response.status_code for response in responses] == [200, 200]
    assert all(response.json()["status"] == "approved" for response in responses)

    scheme = await integration_client.get("/api/v1/scheme/", headers=student)
    dose = next(
        dose
        for vaccine in scheme.json()["vaccines"]
        for dose in vaccine["doses"]
        if dose["id"] == dose_id
    )
    assert dose["status"] == "approved"


@pytest.mark.asyncio
async def test_failed_commit_rolls_back_evidence_and_linked_dose(
    integration_engine, integration_accounts, monkeypatch
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("Atomic rollback verification requires PostgreSQL")
    dose_id = uuid.UUID(await _create_dose(integration_engine, integration_accounts))
    sessions = async_sessionmaker(integration_engine, expire_on_commit=False)
    batch_id = uuid.uuid4()

    async with sessions() as db:
        dose_service_repo = SchemeRepository(db)
        student_dose = await dose_service_repo.get_dose_by_id(dose_id)
        assert student_dose is not None
        batch = EvidenceBatch(
            id=batch_id,
            user_id=integration_accounts["student"],
            dose_id=dose_id,
            status=EvidenceBatchStatus.IN_REVIEW,
        )
        db.add(batch)
        await db.commit()

    async with sessions() as db:
        admin = await db.get(User, integration_accounts["admin"])
        repo = EvidenceRepository(db)
        service = EvidenceService(repo, storage=None)

        async def fail_after_flush():
            await db.flush()
            raise RuntimeError("synthetic commit failure")

        monkeypatch.setattr(repo, "commit", fail_after_flush)
        with pytest.raises(RuntimeError, match="synthetic commit failure"):
            await service.review_batch(
                admin,
                batch_id,
                EvidenceReviewRequest(status=EvidenceReviewStatus.APPROVED),
            )

    async with sessions() as db:
        batch = await db.get(EvidenceBatch, batch_id)
        dose = await db.get(StudentVaccineDose, dose_id)
        assert batch.status == EvidenceBatchStatus.IN_REVIEW
        assert dose.status == DoseStatus.PENDING
