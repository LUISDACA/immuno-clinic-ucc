"""Password reset token ORM model."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.db.base import Base, UUIDMixin
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.modules.users.models import User


class AuthSession(Base, UUIDMixin):
    """Authoritative session; its id is also the refresh-token family id."""

    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','REVOKED','COMPROMISED')", name="ck_session_status"),
        CheckConstraint("protocol_version IN (1,2)", name="ck_session_protocol"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    protocol_version: Mapped[int] = mapped_column(Integer, nullable=False)
    auth_version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(16), default="ACTIVE", server_default="ACTIVE", nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revocation_reason: Mapped[str | None] = mapped_column(String(40))


class WebSession(Base):
    """Private BFF credentials, encrypted by Next; never an authorization authority."""

    __tablename__ = "web_sessions"
    cookie_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    auth_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Deliberately no FK/locks crossing the BFF transaction and the HTTP API transaction.
    encrypted_tokens: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE")


class RateLimitBucket(Base):
    """Shared fixed-window counter; bucket keys are keyed digests, not PII."""

    __tablename__ = "rate_limit_buckets"
    bucket_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class PasswordResetToken(Base, UUIDMixin):
    """Secure token for password recovery flow."""

    __tablename__ = "password_reset_tokens"
    __table_args__ = (UniqueConstraint("token_hash", name="uq_password_reset_tokens_token_hash"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")


class RefreshToken(Base, UUIDMixin):
    """Secure token for session management and revocation."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
        UniqueConstraint("session_id", "generation", name="uq_refresh_generation"),
        Index(
            "uq_refresh_current",
            "session_id",
            unique=True,
            postgresql_where=text(
                "consumed_at IS NULL AND revoked = false AND session_id IS NOT NULL"
            ),
            sqlite_where=text("consumed_at IS NULL AND revoked = 0 AND session_id IS NOT NULL"),
        ),
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth_sessions.id", ondelete="CASCADE"), index=True
    )
    generation: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
