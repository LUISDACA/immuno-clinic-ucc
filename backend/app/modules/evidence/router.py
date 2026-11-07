"""Evidence module API router."""

import io
import uuid

from app.common.api_contracts import PageResponse
from app.core.dependencies import get_current_active_user, require_role
from app.core.rate_limit import RateLimitedRoute, limiter
from app.db.session import get_db
from app.modules.evidence.repository import EvidenceRepository
from app.modules.evidence.schemas import EvidenceBatchResponse, EvidenceReviewRequest
from app.modules.evidence.service import EvidenceService
from app.modules.users.models import User
from app.storage.base import StorageService, get_storage_service
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(route_class=RateLimitedRoute, prefix="/evidence", tags=["Evidence Documents"])


def _get_evidence_service(
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
) -> EvidenceService:
    return EvidenceService(EvidenceRepository(db), storage)


@router.post("/upload", response_model=EvidenceBatchResponse)
@limiter.limit("10/hour")
async def upload_evidence(
    request: Request,
    files: list[UploadFile] = File(...),
    notes: str | None = Form(None),
    dose_id: uuid.UUID | None = Form(None),
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Upload one or more PDF files, optionally linked to a student's dose."""
    batch = await service.upload_evidence(current_user.id, files, notes, dose_id=dose_id)
    return EvidenceBatchResponse.model_validate(batch)


@router.get("/", response_model=list[EvidenceBatchResponse])
async def list_my_evidence(
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """List evidence batches for the current student (paginated)."""
    batches = await service.get_student_batches(
        current_user.id,
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return [EvidenceBatchResponse.model_validate(b) for b in batches]


@router.get("/page", response_model=PageResponse[EvidenceBatchResponse])
async def list_my_evidence_page(
    page: int = Query(1, ge=1, le=10_000),
    size: int = Query(20, ge=1, le=100),
    page_size: int | None = Query(None, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Paginated evidence contract; the legacy list endpoint remains unchanged."""
    size = page_size if page_size is not None else size
    batches = await service.get_student_batches(
        current_user.id,
        limit=size,
        offset=(page - 1) * size,
    )
    total = await service.repo.count_batches_by_user(current_user.id)
    return PageResponse.create(
        [EvidenceBatchResponse.model_validate(batch) for batch in batches],
        total,
        page,
        size,
    )


@router.get("/files/{file_id}")
async def download_evidence_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Download an evidence file after checking ownership or admin scope."""
    filename, mime_type, content = await service.download_file_for_user(
        current_user,
        file_id,
    )
    safe_filename = "".join(c for c in filename if c not in {'"', "\n", "\r", ";", "\\"})
    return StreamingResponse(
        io.BytesIO(content),
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


@router.patch("/batches/{batch_id}/review", response_model=EvidenceBatchResponse)
async def review_evidence_batch(
    batch_id: uuid.UUID,
    data: EvidenceReviewRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Review evidence and atomically approve its linked dose when requested."""
    batch = await service.review_batch(admin, batch_id, data)
    return EvidenceBatchResponse.model_validate(batch)


@router.delete("/{batch_id}", status_code=204)
async def delete_my_evidence(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Delete a specific evidence batch and its files."""
    await service.delete_batch(current_user.id, batch_id)
