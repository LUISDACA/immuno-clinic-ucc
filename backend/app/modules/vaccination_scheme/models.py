"""Student vaccination scheme ORM models."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from app.common.enums import DoseStatus, VaccineStatus
from app.db.base import Base, TimestampMixin, UUIDMixin
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.vaccines.models import Vaccine, VaccineDoseConfig


class StudentVaccine(Base, UUIDMixin, TimestampMixin):
    """Assignment of a vaccine to a student — tracks aggregate review status."""

    __tablename__ = "student_vaccines"
    __table_args__ = (
        UniqueConstraint("user_id", "vaccine_id", name="uq_student_vaccines_user_vaccine"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vaccine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[VaccineStatus] = mapped_column(
        Enum(VaccineStatus, name="vaccine_status_enum"),
        default=VaccineStatus.PENDING,
        nullable=False,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(
        back_populates="student_vaccines",
        foreign_keys=[user_id],
    )
    vaccine: Mapped["Vaccine"] = relationship(lazy="joined")
    reviewer: Mapped["User | None"] = relationship(
        foreign_keys=[reviewed_by],
        lazy="joined",
    )
    doses: Mapped[list["StudentVaccineDose"]] = relationship(
        back_populates="student_vaccine",
        primaryjoin="and_(StudentVaccine.id == StudentVaccineDose.student_vaccine_id, StudentVaccineDose.is_active == True)",
        cascade="all, delete-orphan",
        order_by="StudentVaccineDose.dose_number",
        lazy="selectin",
    )


class StudentVaccineDose(Base, UUIDMixin, TimestampMixin):
    """Individual dose record for a student's vaccine."""

    __tablename__ = "student_vaccine_doses"
    __table_args__ = (
        UniqueConstraint(
            "student_vaccine_id",
            "dose_config_id",
            name="uq_student_vaccine_doses_vaccine_config",
        ),
    )

    student_vaccine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("student_vaccines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dose_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccine_dose_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dose_number: Mapped[int] = mapped_column(Integer, nullable=False)
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    titer_value: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[DoseStatus] = mapped_column(
        Enum(DoseStatus, name="dose_status_enum"),
        default=DoseStatus.PENDING,
        nullable=False,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────
    student_vaccine: Mapped["StudentVaccine"] = relationship(back_populates="doses")
    dose_config: Mapped["VaccineDoseConfig"] = relationship(lazy="joined")
    reviewer: Mapped["User | None"] = relationship(
        foreign_keys=[reviewed_by],
        lazy="joined",
    )


class StudentSchemeVersion(Base, UUIDMixin, TimestampMixin):
    """Append-only snapshot of a student's scheme at a reconciliation boundary."""

    __tablename__ = "student_scheme_versions"
    __table_args__ = (
        UniqueConstraint("user_id", "version_number", name="uq_student_scheme_version_number"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(80), nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
