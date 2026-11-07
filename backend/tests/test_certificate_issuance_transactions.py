"""Atomicity tests for certificate issuance and revocation."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from app.modules.audit.service import AuditService
from app.modules.certificates.models import CertificateEmission, CertificateStatus
from app.modules.certificates.service import CertificateService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_pdf_failure_rolls_back_unpublished_emission(
    db: AsyncSession, student_user, monkeypatch, signed_certificate_service
):
    service, _, _ = signed_certificate_service
    service.scheme_service.get_student_scheme = AsyncMock(return_value=[object()])
    monkeypatch.setattr(
        "app.modules.certificates.service.evaluate_scheme",
        lambda *_args, **_kwargs: type("Eligibility", (), {"is_certifiable": True})(),
    )
    monkeypatch.setattr(
        CertificateService,
        "_render_pdf",
        staticmethod(
            lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("render failure"))
        ),
    )
    with pytest.raises(RuntimeError, match="render failure"):
        await service.issue_certificate(student_user.id)
    assert (await db.execute(select(CertificateEmission))).scalars().all() == []


@pytest.mark.asyncio
async def test_audit_failure_rolls_back_revocation(db: AsyncSession, student_user, monkeypatch):
    emission = CertificateEmission(
        public_id="A" * 43,
        user_id=student_user.id,
        issued_at=datetime.now(timezone.utc),
        status=CertificateStatus.ISSUED,
        document_sha256="a" * 64,
        certificate_version=1,
    )
    db.add(emission)
    await db.commit()

    async def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(AuditService, "log", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        await CertificateService(db).revoke(
            emission.id, actor_id=uuid.uuid4(), reason="Synthetic rollback test"
        )
    await db.refresh(emission)
    assert emission.status is CertificateStatus.ISSUED
    assert emission.revoked_at is None
