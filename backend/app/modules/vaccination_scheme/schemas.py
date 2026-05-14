"""Vaccination scheme module — Pydantic schemas."""

import uuid
from datetime import date, datetime

from app.common.enums import DoseStatus, DoseType, VaccineStatus
from pydantic import BaseModel, Field


class DoseConfigResponse(BaseModel):
    id: uuid.UUID
    dose_number: int
    label: str
    is_required: bool
    applies_to: str
    dose_type: DoseType

    model_config = {"from_attributes": True}


class VaccineResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    base_doses: int
    has_booster: bool
    has_titer: bool
    has_titer_value: bool
    is_annual: bool
    applies_to: str
    display_order: int
    dose_configs: list[DoseConfigResponse] = []

    model_config = {"from_attributes": True}


class StudentDoseResponse(BaseModel):
    id: uuid.UUID
    dose_number: int
    applied_date: date | None = None
    due_date: date | None = None
    days_until_due: int | None = None
    titer_value: str | None = None
    status: DoseStatus
    admin_notes: str | None = None
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    dose_config: DoseConfigResponse | None = None

    model_config = {"from_attributes": True}


class StudentVaccineResponse(BaseModel):
    id: uuid.UUID
    vaccine_id: uuid.UUID
    status: VaccineStatus
    admin_notes: str | None = None
    reviewed_at: datetime | None = None
    vaccine: VaccineResponse | None = None
    doses: list[StudentDoseResponse] = []

    model_config = {"from_attributes": True}


class UpdateDoseRequest(BaseModel):
    applied_date: date | None = None
    titer_value: str | None = Field(None, max_length=50)


class ReviewDoseRequest(BaseModel):
    status: DoseStatus
    admin_notes: str | None = None


class ReviewVaccineRequest(BaseModel):
    status: VaccineStatus
    admin_notes: str | None = None


class SchemeOverviewResponse(BaseModel):
    total_vaccines: int
    approved_vaccines: int
    pending_vaccines: int
    denied_vaccines: int
    in_review_vaccines: int
    vaccines: list[StudentVaccineResponse] = []


class MessageResponse(BaseModel):
    message: str
