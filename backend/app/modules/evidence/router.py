"""Evidence module API router."""

import io
import uuid

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.modules.evidence.repository import EvidenceRepository
from app.modules.evidence.schemas import EvidenceBatchResponse
from app.modules.evidence.service import EvidenceService
from app.modules.users.models import User
from app.storage.base import StorageService, get_storage_service

router = APIRouter(prefix="/evidence", tags=["Evidence Documents"])


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
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Upload one or more PDF files as general documentary evidence."""
    batch = await service.upload_evidence(current_user.id, files, notes)
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


@router.delete("/{batch_id}", status_code=204)
async def delete_my_evidence(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: EvidenceService = Depends(_get_evidence_service),
):
    """Delete a specific evidence batch and its files."""
    await service.delete_batch(current_user.id, batch_id)
