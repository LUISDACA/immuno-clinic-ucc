"""User and Profile ORM models."""

import uuid
from datetime import date
from typing import TYPE_CHECKING

from app.common.enums import Gender, Role
from app.db.base import Base, TimestampMixin, UUIDMixin
from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.modules.audit.models import AuditLog
    from app.modules.auth.models import PasswordResetToken, RefreshToken
    from app.modules.evidence.models import EvidenceBatch
    from app.modules.notifications.models import Notification
    from app.modules.vaccination_scheme.models import StudentVaccine


class User(Base, UUIDMixin, TimestampMixin):
    """Application user — either admin or student."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role, name="role_enum"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auth_version: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────
    profile: Mapped["Profile"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )
    student_vaccines: Mapped[list["StudentVaccine"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="StudentVaccine.user_id",
        primaryjoin="and_(User.id == StudentVaccine.user_id, StudentVaccine.is_active == True)",
        lazy="noload",
    )
    evidence_batches: Mapped[list["EvidenceBatch"]] = relationship(
        back_populates="user",
        foreign_keys="EvidenceBatch.user_id",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    audit_logs_as_actor: Mapped[list["AuditLog"]] = relationship(
        back_populates="actor",
        foreign_keys="AuditLog.actor_id",
        lazy="noload",
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )


class Profile(Base, UUIDMixin, TimestampMixin):
    """Extended profile data for a user."""

    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    document_number: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    student_id: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sex: Mapped[Gender] = mapped_column(Enum(Gender, name="gender_enum"), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    eps_affiliation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    program: Mapped[str | None] = mapped_column(String(150), nullable=True)
    campus: Mapped[str | None] = mapped_column(String(150), nullable=True)
    semester: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="profile")
