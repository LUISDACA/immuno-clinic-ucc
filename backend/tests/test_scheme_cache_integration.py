"""Integration tests for the /scheme cache invalidation contract.

These tests verify the *contract* between write paths and the cache:
when a write operation that affects a student's scheme commits, the
corresponding cache entry must be invalidated so subsequent reads see
fresh data.

We use unittest.mock to bypass the database while still exercising the
real production code path of ``SchemeService`` and ``EvidenceService``.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.common.enums import DoseStatus, VaccineStatus
from app.core import cache as cache_module
from app.modules.evidence.service import EvidenceService
from app.modules.vaccination_scheme.schemas import ReviewDoseRequest
from app.modules.vaccination_scheme.service import SchemeService


@pytest.fixture(autouse=True)
def _clear_scheme_cache():
    cache_module.student_scheme_cache.clear()
    yield
    cache_module.student_scheme_cache.clear()


def _build_dose_and_vaccine(
    *,
    student_vaccine_id: uuid.UUID,
    student_user_id: uuid.UUID,
    dose_id: uuid.UUID,
) -> tuple[SimpleNamespace, SimpleNamespace]:
    """Build a minimal dose + student_vaccine pair with the back-refs the rules engine needs."""
    dose_config = SimpleNamespace(
        id=uuid.uuid4(),
        dose_number=1,
        label="Primera dosis",
        is_required=True,
        applies_to="all",
        dose_type="standard",
    )
    vaccine = SimpleNamespace(
        id=uuid.uuid4(),
        name="Hepatitis B",
        code="HEP_B",
        has_titer=False,
        is_annual=False,
        rules=[],
        base_doses=1,
    )
    dose = SimpleNamespace(
        id=dose_id,
        student_vaccine_id=student_vaccine_id,
        dose_config_id=dose_config.id,
        dose_number=1,
        dose_config=dose_config,
        status=DoseStatus.PENDING,
        admin_notes=None,
        reviewed_by=None,
        reviewed_at=None,
        applied_date=None,
        titer_value=None,
    )
    student_vaccine = SimpleNamespace(
        id=student_vaccine_id,
        user_id=student_user_id,
        vaccine=vaccine,
        vaccine_id=vaccine.id,
        status=VaccineStatus.PENDING,
        admin_notes=None,
        reviewed_by=None,
        reviewed_at=None,
        doses=[dose],
    )
    dose.student_vaccine = student_vaccine
    return student_vaccine, dose


@pytest.mark.asyncio
async def test_review_dose_invalidates_student_scheme_cache():
    """After an admin reviews a dose, the student's scheme cache must be empty."""
    student_user_id = uuid.uuid4()
    dose_id = uuid.uuid4()
    student_vaccine_id = uuid.uuid4()

    cache_module.student_scheme_cache[student_user_id] = "stale-response"

    student_vaccine, dose = _build_dose_and_vaccine(
        student_vaccine_id=student_vaccine_id,
        student_user_id=student_user_id,
        dose_id=dose_id,
    )

    scheme_repo = MagicMock()
    scheme_repo.get_dose_by_id = AsyncMock(return_value=dose)
    scheme_repo.get_student_vaccine = AsyncMock(return_value=student_vaccine)
    scheme_repo.commit = AsyncMock()
    scheme_repo.db = MagicMock()

    service = SchemeService.__new__(SchemeService)
    service.scheme_repo = scheme_repo
    service.vaccine_repo = MagicMock()
    service.audit = MagicMock()
    service.audit.log = AsyncMock()

    await service.review_dose(
        dose_id=dose_id,
        admin_id=uuid.uuid4(),
        data=ReviewDoseRequest(status=DoseStatus.APPROVED, admin_notes=None),
        commit=True,
    )

    assert student_user_id not in cache_module.student_scheme_cache


@pytest.mark.asyncio
async def test_review_dose_without_commit_keeps_cache():
    """If the write is not committed, the cache must NOT be invalidated.

    This protects callers that batch multiple updates and only commit once
    at the end (e.g. bulk dose reviews).
    """
    student_user_id = uuid.uuid4()
    dose_id = uuid.uuid4()
    student_vaccine_id = uuid.uuid4()

    cached_value = "fresh-response"
    cache_module.student_scheme_cache[student_user_id] = cached_value

    student_vaccine, dose = _build_dose_and_vaccine(
        student_vaccine_id=student_vaccine_id,
        student_user_id=student_user_id,
        dose_id=dose_id,
    )

    scheme_repo = MagicMock()
    scheme_repo.get_dose_by_id = AsyncMock(return_value=dose)
    scheme_repo.get_student_vaccine = AsyncMock(return_value=student_vaccine)
    scheme_repo.commit = AsyncMock()
    scheme_repo.db = MagicMock()

    service = SchemeService.__new__(SchemeService)
    service.scheme_repo = scheme_repo
    service.vaccine_repo = MagicMock()
    service.audit = MagicMock()
    service.audit.log = AsyncMock()

    await service.review_dose(
        dose_id=dose_id,
        admin_id=uuid.uuid4(),
        data=ReviewDoseRequest(status=DoseStatus.APPROVED, admin_notes=None),
        commit=False,
    )

    # No commit → no invalidation. The previous cache entry must remain.
    assert cache_module.student_scheme_cache.get(student_user_id) == cached_value


@pytest.mark.asyncio
async def test_evidence_upload_does_not_invalidate_clinical_scheme_cache():
    """Evidence state is separate from the clinical scheme and must not mutate it."""
    student_user_id = uuid.uuid4()
    batch_id = uuid.uuid4()

    cache_module.student_scheme_cache[student_user_id] = "stale-after-upload"

    batch = SimpleNamespace(id=batch_id, user_id=student_user_id)

    repo = MagicMock()
    repo.create_batch = AsyncMock(return_value=batch)
    repo.add_file = AsyncMock()
    repo.commit = AsyncMock()
    repo.get_batch_by_id = AsyncMock(return_value=batch)
    repo.db = MagicMock()

    storage = MagicMock()
    storage.upload = AsyncMock(return_value="/storage/path/file.pdf")

    upload_file = MagicMock()
    upload_file.filename = "evidencia.pdf"
    upload_file.content_type = "application/pdf"

    # Patch validate_pdf_file to short-circuit IO.
    import app.modules.evidence.service as evidence_service_module

    async def fake_validate(_file):
        return b"%PDF-1.4\n%fake\n"

    original_validator = evidence_service_module.validate_pdf_file
    evidence_service_module.validate_pdf_file = fake_validate

    try:
        service = EvidenceService.__new__(EvidenceService)
        service.repo = repo
        service.storage = storage
        service.audit = MagicMock()
        service.audit.log = AsyncMock()

        await service.upload_evidence(
            user_id=student_user_id,
            files=[upload_file],
            notes="batch de prueba",
        )
    finally:
        evidence_service_module.validate_pdf_file = original_validator

    assert cache_module.student_scheme_cache.get(student_user_id) == "stale-after-upload"
