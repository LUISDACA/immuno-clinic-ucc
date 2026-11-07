"""Persisted certificate issuance and verification records."""

import enum
import uuid
from datetime import datetime

from app.db.base import Base, TimestampMixin, UUIDMixin
from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column


class CertificateStatus(str, enum.Enum):
    ISSUED = "issued"
    REVOKED = "revoked"


class CertificateEmission(Base, UUIDMixin, TimestampMixin):
    """One immutable issued document; revocation is an irreversible state change."""

    __tablename__ = "certificate_emissions"

    public_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[CertificateStatus] = mapped_column(
        Enum(CertificateStatus, name="certificate_status_enum"), nullable=False
    )
    document_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    certificate_version: Mapped[int] = mapped_column(nullable=False, default=1)
    # Nullable only for certificates issued before signature versioning was added.
    signature_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("certificate_signatures.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # Nullable for historical emissions created before explicit signer assignments.
    signer_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    signer_assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("certificate_signer_assignments.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revocation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class CertificateSignature(Base, UUIDMixin, TimestampMixin):
    """Private, immutable administrator signature image version."""

    __tablename__ = "certificate_signatures"
    __table_args__ = (Index("ix_certificate_signatures_active", "admin_id", "is_active"),)

    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CertificateSignerAssignment(Base, UUIDMixin, TimestampMixin):
    """Append-only history of the explicitly responsible admin per program/campus."""

    __tablename__ = "certificate_signer_assignments"
    __table_args__ = (
        Index(
            "uq_certificate_signer_assignments_active_scope",
            "program",
            "campus",
            unique=True,
            postgresql_where=text("active IS TRUE"),
            sqlite_where=text("active = 1"),
        ),
    )

    program: Mapped[str] = mapped_column(String(150), nullable=False)
    campus: Mapped[str] = mapped_column(String(150), nullable=False)
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    assigned_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class CertificateSignerAssignmentConflict(Base, UUIDMixin):
    """Read-only record of ambiguous legacy scopes found by the additive migration."""

    __tablename__ = "certificate_signer_assignment_conflicts"
    __table_args__ = (
        Index("uq_certificate_signer_assignment_conflict_scope", "program", "campus", unique=True),
    )

    program: Mapped[str] = mapped_column(String(150), nullable=False)
    campus: Mapped[str] = mapped_column(String(150), nullable=False)
    admin_ids: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
