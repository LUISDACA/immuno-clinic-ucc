"""Evidence module — schemas, repository, service, and router."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.common.enums import EvidenceBatchStatus

# ── Schemas ───────────────────────────────────────────────────────────


class EvidenceFileResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class EvidenceBatchResponse(BaseModel):
    id: uuid.UUID
    status: EvidenceBatchStatus
    notes: str | None = None
    created_at: datetime
    files: list[EvidenceFileResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}
