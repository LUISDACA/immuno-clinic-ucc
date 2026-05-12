"""Audit module schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditActorResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None = None
    role: str | None = None


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    actor: AuditActorResponse | None = None
    action: str
    target_type: str | None = None
    target_id: uuid.UUID | None = None
    details: dict | None = None
    created_at: datetime
