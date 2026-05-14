"""Admin module — schemas."""

import uuid
from datetime import date

from app.common.academic import ACADEMIC_PROGRAMS, CAMPUSES
from app.common.enums import AppliesTo, DoseType, Gender
from app.modules.users.schemas import UserResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AcademicScopeMixin(BaseModel):
    @field_validator("program", check_fields=False)
    @classmethod
    def validate_program(cls, value: str | None) -> str | None:
        if value is not None and value not in ACADEMIC_PROGRAMS:
            raise ValueError("Programa no válido")
        return value

    @field_validator("campus", check_fields=False)
    @classmethod
    def validate_campus(cls, value: str | None) -> str | None:
        if value is not None and value not in CAMPUSES:
            raise ValueError("Campus no válido")
        return value


class CreateStudentRequest(AcademicScopeMixin):
    email: EmailStr
    password: str | None = Field(None, min_length=8)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    document_number: str = Field(min_length=1, max_length=50)
    student_id: str | None = Field(None, max_length=50)
    birth_date: date | None = None
    sex: Gender
    phone: str | None = Field(None, max_length=20)
    eps_affiliation: str | None = Field(None, max_length=150)
    emergency_contact_name: str | None = Field(None, max_length=150)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    program: str | None = Field(None, max_length=150)
    campus: str | None = Field(None, max_length=150)
    semester: int | None = Field(None, ge=1, le=20)


class UpdateStudentProfileRequest(AcademicScopeMixin):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    document_number: str | None = Field(None, max_length=50)
    student_id: str | None = Field(None, max_length=50)
    birth_date: date | None = None
    sex: Gender | None = None
    phone: str | None = Field(None, max_length=20)
    eps_affiliation: str | None = Field(None, max_length=150)
    emergency_contact_name: str | None = Field(None, max_length=150)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    program: str | None = Field(None, max_length=150)
    campus: str | None = Field(None, max_length=150)
    semester: int | None = Field(None, ge=1, le=20)


class CreateAdminRequest(AcademicScopeMixin):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    job_title: str | None = Field(None, max_length=150)
    program: str = Field(max_length=150)
    campus: str = Field(max_length=150)


class StudentListParams(AcademicScopeMixin):
    search: str | None = None
    is_active: bool | None = None
    program: str | None = None
    campus: str | None = None
    sex: Gender | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class ImportStudentRowResult(BaseModel):
    row: int
    email: str | None = None
    status: str
    message: str


class ImportStudentsResponse(BaseModel):
    total_rows: int
    created: int
    skipped: int
    errors: int
    results: list[ImportStudentRowResult]


class ImportPreviewRow(BaseModel):
    row: int
    email: str | None = None
    name: str | None = None
    predicted_status: str  # "will_create" | "will_skip" | "error"
    message: str


class ImportPreviewResponse(BaseModel):
    total_rows: int
    will_create: int
    will_skip: int
    errors: int
    rows: list[ImportPreviewRow]


class AdminStudentListItem(UserResponse):
    vaccination_status: str


class AdminStudentListResponse(BaseModel):
    items: list[AdminStudentListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class VaccinationStatusStats(BaseModel):
    approved: int
    pending: int


class VaccineComplianceStats(BaseModel):
    vaccine_id: uuid.UUID
    name: str
    code: str
    up_to_date: int
    pending: int
    denied: int
    in_review: int
    total: int


class AdminStatisticsResponse(BaseModel):
    total_students: int
    active_students: int
    inactive_students: int
    by_sex: dict[str, int]
    by_campus: dict[str, int] = {}
    by_program: dict[str, int] = {}
    vaccination_status: VaccinationStatusStats
    vaccine_compliance: list[VaccineComplianceStats] = []


class MessageResponse(BaseModel):
    message: str


# ── Vaccine catalog ───────────────────────────────────────────────────


class VaccineDoseConfigInput(BaseModel):
    dose_number: int = Field(ge=1, le=20)
    label: str = Field(min_length=1, max_length=100)
    is_required: bool = True
    applies_to: AppliesTo = AppliesTo.ALL
    dose_type: DoseType = DoseType.STANDARD


class VaccineCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Z0-9_]+$")
    base_doses: int = Field(default=1, ge=1, le=20)
    has_booster: bool = False
    has_titer: bool = False
    has_titer_value: bool = False
    is_annual: bool = False
    applies_to: AppliesTo = AppliesTo.ALL
    display_order: int = Field(default=0, ge=0, le=1000)
    dose_configs: list[VaccineDoseConfigInput] = Field(default_factory=list)


class VaccineUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    base_doses: int | None = Field(None, ge=1, le=20)
    has_booster: bool | None = None
    has_titer: bool | None = None
    has_titer_value: bool | None = None
    is_annual: bool | None = None
    applies_to: AppliesTo | None = None
    display_order: int | None = Field(None, ge=0, le=1000)
    dose_configs: list[VaccineDoseConfigInput] | None = None


class VaccineDoseConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dose_number: int
    label: str
    is_required: bool
    applies_to: AppliesTo
    dose_type: DoseType


class VaccineCatalogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    base_doses: int
    has_booster: bool
    has_titer: bool
    has_titer_value: bool
    is_annual: bool
    applies_to: AppliesTo
    is_active: bool
    display_order: int
    dose_configs: list[VaccineDoseConfigResponse]
