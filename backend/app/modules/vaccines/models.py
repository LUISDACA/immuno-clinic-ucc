"""Vaccine catalog ORM models — parametric configuration."""

import uuid

from app.common.enums import AppliesTo, DoseType
from app.db.base import Base, TimestampMixin, UUIDMixin
from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Vaccine(Base, UUIDMixin, TimestampMixin):
    """Vaccine catalog entry — parametric definition."""

    __tablename__ = "vaccines"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    base_doses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    has_booster: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_titer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_titer_value: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_annual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    applies_to: Mapped[AppliesTo] = mapped_column(
        Enum(AppliesTo, name="applies_to_enum"),
        default=AppliesTo.ALL,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────
    dose_configs: Mapped[list["VaccineDoseConfig"]] = relationship(
        back_populates="vaccine",
        cascade="all, delete-orphan",
        order_by="VaccineDoseConfig.dose_number",
        lazy="selectin",
    )
    rules: Mapped[list["VaccineRule"]] = relationship(
        back_populates="vaccine",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class VaccineDoseConfig(Base, UUIDMixin):
    """Per-vaccine dose template — defines what doses exist and for whom."""

    __tablename__ = "vaccine_dose_configs"
    __table_args__ = (
        UniqueConstraint(
            "vaccine_id",
            "dose_number",
            name="uq_vaccine_dose_configs_vaccine_dose_number",
        ),
    )

    vaccine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccines.id", ondelete="CASCADE"),
        nullable=False,
    )
    dose_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    applies_to: Mapped[AppliesTo] = mapped_column(
        Enum(AppliesTo, name="applies_to_enum", create_type=False),
        default=AppliesTo.ALL,
        nullable=False,
    )
    dose_type: Mapped[DoseType] = mapped_column(
        Enum(DoseType, name="dose_type_enum"),
        default=DoseType.STANDARD,
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    vaccine: Mapped["Vaccine"] = relationship(back_populates="dose_configs")


class VaccineRule(Base, UUIDMixin):
    """Conditional business rule for a vaccine (stored as JSONB)."""

    __tablename__ = "vaccine_rules"

    vaccine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vaccines.id", ondelete="CASCADE"),
        nullable=False,
    )
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_config: Mapped[dict] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    vaccine: Mapped["Vaccine"] = relationship(back_populates="rules")
