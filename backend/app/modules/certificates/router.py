"""Authenticated certificate actions and a minimal public verifier."""

import hashlib
import io
import re
import uuid
from datetime import datetime
from typing import Literal

from app.common.access import ensure_student_in_admin_scope, is_app_admin
from app.common.enums import Role
from app.core.dependencies import get_current_active_user, require_role
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.rate_limit import RateLimitedRoute, limiter
from app.db.session import get_db
from app.modules.certificates.models import CertificateEmission, CertificateStatus
from app.modules.certificates.service import CertificateService
from app.modules.certificates.signature_service import MAX_BYTES, CertificateSignatureService
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.storage.base import StorageService, get_storage_service
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(route_class=RateLimitedRoute, prefix="/certificates", tags=["Certificates"])
verification_router = APIRouter(route_class=RateLimitedRoute, tags=["Certificate verification"])


class RevokeCertificateRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def require_nonblank_reason(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Revocation reason is required")
        return cleaned


class CertificateEmissionResponse(BaseModel):
    id: uuid.UUID
    public_id: str
    issued_at: datetime
    status: Literal["ISSUED", "REVOKED"]
    revoked_at: datetime | None
    document_sha256: str


class CertificateRevocationResponse(BaseModel):
    status: Literal["REVOKED"]
    revoked_at: datetime | None


class CertificateVerificationResponse(BaseModel):
    status: Literal["VALID", "REVOKED", "NOT_FOUND", "INVALID"]
    integrity: Literal["NOT_CHECKED", "MATCH", "MISMATCH"]
    document_sha256: str | None = None
    issued_at: datetime | None = None
    revoked_at: datetime | None = None


class CertificateSignatureResponse(BaseModel):
    id: uuid.UUID
    sha256: str
    created_at: datetime
    active: Literal[True]


@router.post("/signature", response_model=CertificateSignatureResponse)
@limiter.limit("5/hour")
async def upload_admin_signature(
    request: Request,
    file: UploadFile = File(...),
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
):
    data = await file.read(MAX_BYTES + 1)
    signature = await CertificateSignatureService(db, storage).upload(
        admin, data, file.content_type or ""
    )
    return {
        "id": signature.id,
        "sha256": signature.sha256,
        "created_at": signature.created_at,
        "active": True,
    }


@router.get("/signature/active", response_model=CertificateSignatureResponse)
@limiter.limit("20/minute")
async def get_active_admin_signature(
    request: Request,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
):
    signature = await CertificateSignatureService(db, storage).active_for(admin.id)
    if signature is None:
        raise NotFoundException("Firma activa")
    return {
        "id": signature.id,
        "sha256": signature.sha256,
        "created_at": signature.created_at,
        "active": True,
    }


@router.get("/signature/active/image")
@limiter.limit("20/minute")
async def download_active_admin_signature(
    request: Request,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
):
    signature = await CertificateSignatureService(db, storage).active_for(admin.id)
    if signature is None:
        raise NotFoundException("Firma activa")
    data = await storage.download(signature.storage_key)
    if hashlib.sha256(data).hexdigest() != signature.sha256:
        raise RuntimeError("Stored signature integrity check failed")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="image/png",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'inline; filename="firma.png"',
        },
    )


@router.get("/students/{student_id}", response_model=list[CertificateEmissionResponse])
@limiter.limit("30/minute")
async def list_student_certificates(
    request: Request,
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    db: AsyncSession = Depends(get_db),
):
    student = await UserRepository(db).get_by_id(student_id)
    if student is None or student.role != Role.STUDENT:
        raise BadRequestException("Estudiante no encontrado")
    if not is_app_admin(admin):
        ensure_student_in_admin_scope(admin, student)
    result = await db.execute(
        select(CertificateEmission)
        .where(CertificateEmission.user_id == student_id)
        .order_by(CertificateEmission.issued_at.desc())
        .limit(50)
    )
    return [
        {
            "id": row.id,
            "public_id": row.public_id,
            "issued_at": row.issued_at,
            "status": row.status.value.upper(),
            "revoked_at": row.revoked_at,
            "document_sha256": row.document_sha256,
        }
        for row in result.scalars().all()
    ]


@router.get("/scheme")
@limiter.limit("20/minute")
async def download_certificate(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
):
    issued = await CertificateService(db, storage).issue_certificate(current_user.id)
    return StreamingResponse(
        issued.pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="certificado_vacunacion.pdf"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/{certificate_id}/revoke", response_model=CertificateRevocationResponse)
@limiter.limit("10/minute")
async def revoke_certificate(
    request: Request,
    certificate_id: uuid.UUID,
    data: RevokeCertificateRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    db: AsyncSession = Depends(get_db),
):
    emission = await db.get(CertificateEmission, certificate_id)
    if emission is None:
        raise BadRequestException("Certificado no encontrado")
    if not is_app_admin(admin):
        student = await UserRepository(db).get_by_id(emission.user_id) if emission.user_id else None
        if student is None:
            raise BadRequestException("Certificado no encontrado")
        ensure_student_in_admin_scope(admin, student)
    revoked = await CertificateService(db).revoke(
        certificate_id, actor_id=admin.id, reason=data.reason
    )
    return {"status": revoked.status.value.upper(), "revoked_at": revoked.revoked_at}


@verification_router.get("/verify/{public_id}", response_model=CertificateVerificationResponse)
@limiter.limit("30/minute")
async def verify_certificate(
    request: Request,
    public_id: str,
    sha256: str | None = Query(default=None, max_length=128),
    db: AsyncSession = Depends(get_db),
):
    headers = {
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
    }
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", public_id):
        payload = {"status": "INVALID", "integrity": "NOT_CHECKED"}
        return JSONResponse(payload, headers=headers)
    if sha256 is not None and not re.fullmatch(r"[0-9a-fA-F]{64}", sha256):
        return JSONResponse({"status": "INVALID", "integrity": "MISMATCH"}, headers=headers)
    result = await db.execute(
        select(CertificateEmission).where(CertificateEmission.public_id == public_id)
    )
    emission = result.scalar_one_or_none()
    if emission is None:
        return JSONResponse({"status": "NOT_FOUND", "integrity": "NOT_CHECKED"}, headers=headers)
    integrity = "NOT_CHECKED"
    if sha256 is not None:
        integrity = "MATCH" if sha256.lower() == emission.document_sha256 else "MISMATCH"
    if emission.status == CertificateStatus.REVOKED:
        status = "REVOKED"
    elif integrity == "MISMATCH":
        status = "INVALID"
    else:
        status = "VALID"
    return JSONResponse(
        {
            "status": status,
            "integrity": integrity,
            "document_sha256": emission.document_sha256,
            "issued_at": emission.issued_at.isoformat(),
            "revoked_at": emission.revoked_at.isoformat() if emission.revoked_at else None,
        },
        headers=headers,
    )
