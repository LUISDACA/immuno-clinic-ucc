"""Users module — Pydantic schemas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.common.enums import Gender, Role


class ProfileResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    job_title: str | None = None
    document_number: str | None = None
    student_id: str | None = None
    birth_date: date | None = None
    sex: Gender
    phone: str | None = None
    eps_affiliation: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    program: str | None = None
    campus: str | None = None
    semester: int | None = None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    is_active: bool
    must_change_password: bool
    created_at: datetime
    profile: ProfileResponse | None = None

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    job_title: str | None = Field(None, max_length=150)
    birth_date: date | None = None
    phone: str | None = Field(None, max_length=20)
    eps_affiliation: str | None = Field(None, max_length=150)
    emergency_contact_name: str | None = Field(None, max_length=150)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    program: str | None = Field(None, max_length=150)
    campus: str | None = Field(None, max_length=150)
    semester: int | None = Field(None, ge=1, le=20)


class UserListFilters(BaseModel):
    search: str | None = None
    is_active: bool | None = None
    program: str | None = None
    campus: str | None = None
    sex: Gender | None = None
