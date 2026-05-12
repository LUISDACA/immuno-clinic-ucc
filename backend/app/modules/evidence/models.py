"""Evidence document ORM models — general documentary upload."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import EvidenceBatchStatus
from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.users.models import User


class EvidenceBatch(Base, UUIDMixin, TimestampMixin):
    """A general documentary submission by a student for their entire scheme."""

    __tablename__ = "evidence_batches"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[EvidenceBatchStatus] = mapped_column(
        Enum(EvidenceBatchStatus, name="evidence_batch_status_enum"),
        default=EvidenceBatchStatus.UPLOADED,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="evidence_batches")
    files: Mapped[list["EvidenceFile"]] = relationship(
        back_populates="batch",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class EvidenceFile(Base, UUIDMixin):
    """Individual PDF file within an evidence batch."""

    __tablename__ = "evidence_files"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evidence_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), default="application/pdf", nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    batch: Mapped["EvidenceBatch"] = relationship(back_populates="files")
