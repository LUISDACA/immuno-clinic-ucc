"""Admin module — API router (admin-only endpoints)."""

import uuid
from datetime import datetime

from app.common.academic import ACADEMIC_PROGRAMS, ACADEMIC_SEMESTERS, CAMPUSES
from app.common.api_contracts import PageResponse
from app.common.enums import Gender
from app.core.dependencies import require_role
from app.core.rate_limit import RateLimitedRoute, limiter
from app.db.session import get_db
from app.modules.admin.import_students.service import AdminStudentImportService
from app.modules.admin.presenters import student_list_item
from app.modules.admin.schemas import (
    AdminStatisticsResponse,
    AdminStudentListResponse,
    CreateAdminRequest,
    CreateStudentRequest,
    ImportPreviewResponse,
    ImportStudentsResponse,
    MessageResponse,
    StudentSearchRequest,
    UpdateStudentProfileRequest,
    VaccineCatalogResponse,
    VaccineCreateRequest,
    VaccineUpdateRequest,
)
from app.modules.admin.service import AdminDependencies
from app.modules.certificates.assignment_service import CertificateSignerAssignmentService
from app.modules.certificates.service import CertificateService
from app.modules.evidence.repository import EvidenceRepository
from app.modules.evidence.schemas import EvidenceBatchResponse
from app.modules.evidence.service import EvidenceService
from app.modules.users.models import User
from app.modules.users.schemas import UserResponse
from app.modules.vaccination_scheme.rules import due_info_by_dose
from app.modules.vaccination_scheme.schemas import (
    ReviewDoseRequest,
    StudentVaccineResponse,
    UpdateDoseCommentRequest,
)
from app.storage.base import StorageService, get_storage_service
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(route_class=RateLimitedRoute, prefix="/admin", tags=["Admin"])


class CertificateSignerAssignmentRequest(BaseModel):
    program: str = Field(min_length=1, max_length=150)
    campus: str = Field(min_length=1, max_length=150)
    admin_id: uuid.UUID

    @field_validator("program", "campus")
    @classmethod
    def strip_scope(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("El ámbito no puede estar vacío")
        return value


class CertificateSignerAssignmentResponse(BaseModel):
    id: uuid.UUID
    program: str
    campus: str
    admin_id: uuid.UUID
    assigned_by_id: uuid.UUID
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CertificateSignerConflictResponse(BaseModel):
    program: str
    campus: str
    admin_ids: list[str]
    detected_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AcademicOptionsResponse(BaseModel):
    programs: list[str]
    campuses: list[str]
    semesters: list[int]


# ── Dependency factories ──────────────────────────────────────────────
# Each endpoint injects only the sub-service it needs, eliminating
# the old AdminService facade that proxied every call.


def _get_deps(db: AsyncSession = Depends(get_db)) -> AdminDependencies:
    return AdminDependencies(db)


def _get_evidence_service(
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
) -> EvidenceService:
    return EvidenceService(EvidenceRepository(db), storage)


@router.get("/academic-options", response_model=AcademicOptionsResponse)
async def get_academic_options(
    _admin: User = Depends(require_role("admin", "app_admin")),
):
    """Return canonical academic choices used by administrative clients."""
    return {
        "programs": list(ACADEMIC_PROGRAMS),
        "campuses": list(CAMPUSES),
        "semesters": list(ACADEMIC_SEMESTERS),
    }


# ── Student CRUD ──────────────────────────────────────────────────────


@router.post("/students", response_model=UserResponse)
async def create_student(
    data: CreateStudentRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Create a new student with profile, vaccine assignment, and dose generation."""
    student = await deps.student_service.create_student(admin, data)
    return UserResponse.model_validate(student)


@router.get("/students", response_model=AdminStudentListResponse)
async def list_students(
    search: str | None = Query(None, max_length=100),
    is_active: bool | None = Query(None),
    program: str | None = Query(None),
    campus: str | None = Query(None),
    sex: Gender | None = Query(None),
    semester: int | None = Query(None, ge=1, le=20),
    vaccination_status: str | None = Query(None, pattern="^(approved|pending)$"),
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(20, ge=1, le=100),
    size: int | None = Query(None, ge=1, le=100),
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """List students with filtering and pagination."""
    effective_size = size if size is not None else page_size
    offset = (page - 1) * effective_size
    students, total = await deps.report_service.list_students(
        admin,
        search=search,
        is_active=is_active,
        program=program,
        campus=campus,
        sex=sex.value if sex else None,
        semester=semester,
        vaccination_status=vaccination_status,
        offset=offset,
        limit=effective_size,
    )
    return {
        "items": [student_list_item(s) for s in students],
        "total": total,
        "page": page,
        "page_size": effective_size,
        "total_pages": (total + effective_size - 1) // effective_size,
        "size": effective_size,
        "pages": (total + effective_size - 1) // effective_size,
        "has_next": page < (total + effective_size - 1) // effective_size,
        "has_previous": page > 1 and total > 0,
    }


@router.post("/students/search", response_model=AdminStudentListResponse)
async def search_students(
    data: StudentSearchRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Body-based compatibility endpoint for filters that may contain PII."""
    effective_size = data.size if data.size is not None else data.page_size
    students, total = await deps.report_service.list_students(
        admin,
        search=data.search,
        is_active=data.is_active,
        program=data.program,
        campus=data.campus,
        sex=data.sex.value if data.sex else None,
        semester=data.semester,
        vaccination_status=data.vaccination_status,
        offset=(data.page - 1) * effective_size,
        limit=effective_size,
    )
    return {
        "items": [student_list_item(student) for student in students],
        "total": total,
        "page": data.page,
        "page_size": effective_size,
        "total_pages": (total + effective_size - 1) // effective_size,
        "size": effective_size,
        "pages": (total + effective_size - 1) // effective_size,
        "has_next": data.page < (total + effective_size - 1) // effective_size,
        "has_previous": data.page > 1 and total > 0,
    }


@router.get("/students/export")
@limiter.limit("10/minute")
async def export_students(
    request: Request,
    search: str | None = Query(None, max_length=100),
    is_active: bool | None = Query(None),
    program: str | None = Query(None),
    campus: str | None = Query(None),
    sex: Gender | None = Query(None),
    semester: int | None = Query(None, ge=1, le=20),
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Export students to CSV with all doses and dates."""
    csv_data = await deps.report_service.export_students_csv(
        admin,
        search=search,
        is_active=is_active,
        program=program,
        campus=campus,
        sex=sex.value if sex else None,
        semester=semester,
    )

    # We must yield the string or encode it to bytes
    def iterfile():
        # Encode with UTF-8 BOM so Excel opens it with correct accents
        yield b"\xef\xbb\xbf"
        yield csv_data.encode("utf-8")

    return StreamingResponse(
        iterfile(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reporte_estudiantes.csv"},
    )


@router.post("/students/import/preview", response_model=ImportPreviewResponse)
@limiter.limit("20/minute")
async def preview_import_students(
    request: Request,
    file: UploadFile = File(...),
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Parse a CSV/XLSX file and return what would happen (no writes)."""
    importer = AdminStudentImportService(deps)
    return await importer.preview_import(file)


@router.post("/students/import", response_model=ImportStudentsResponse)
@limiter.limit("5/minute")
async def import_students(
    request: Request,
    file: UploadFile = File(...),
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Import students from an Excel .xlsx file."""
    importer = AdminStudentImportService(deps)
    return await importer.import_students_from_file(admin, file)


@router.get("/students/{student_id}", response_model=UserResponse)
async def get_student_detail(
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Get full detail of a student."""
    student = await deps.student_service.get_student_detail(admin, student_id)
    return UserResponse.model_validate(student)


@router.put("/students/{student_id}/profile", response_model=UserResponse)
async def update_student_profile(
    student_id: uuid.UUID,
    data: UpdateStudentProfileRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Update a student's profile. If sex changes, scheme is regenerated."""
    student = await deps.student_service.update_student_profile(admin, student_id, data)
    return UserResponse.model_validate(student)


@router.post("/students/{student_id}/deactivate", response_model=MessageResponse)
async def deactivate_student(
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Soft-deactivate a student (is_active = false)."""
    await deps.student_service.deactivate_student(admin, student_id)
    return {"message": "Estudiante desactivado correctamente"}


@router.post("/students/{student_id}/reactivate", response_model=MessageResponse)
async def reactivate_student(
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Reactivate a previously deactivated student."""
    await deps.student_service.reactivate_student(admin, student_id)
    return {"message": "Estudiante reactivado correctamente"}


@router.delete("/students/{student_id}", status_code=204)
async def delete_student(
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
    storage: StorageService = Depends(get_storage_service),
):
    """Permanently delete a student, cascading all their data and evidence files."""
    await deps.student_service.delete_student(admin, student_id, storage)


# ── Student scheme & evidence (admin view) ────────────────────────────


@router.get("/students/{student_id}/scheme", response_model=list[StudentVaccineResponse])
async def get_student_scheme(
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Get a student's full vaccination scheme (admin view), enriched with due dates."""
    await deps.student_service.ensure_student_access(admin, student_id)
    vaccines = await deps.scheme_service.get_student_scheme(student_id)
    return [_admin_vaccine_response(v) for v in vaccines]


def _admin_vaccine_response(student_vaccine) -> StudentVaccineResponse:
    """Build a StudentVaccineResponse enriched with per-dose due-date info."""
    response = StudentVaccineResponse.model_validate(student_vaccine)
    due_by_dose = due_info_by_dose(student_vaccine)
    for dose in response.doses:
        info = due_by_dose.get(dose.id)
        if info is None:
            continue
        dose.due_date = info.due_date
        dose.days_until_due = info.days_until_due
        dose.is_overdue = info.is_overdue
        dose.is_due_today = info.is_due_today
    return response


@router.get("/students/{student_id}/evidence", response_model=list[EvidenceBatchResponse])
async def get_student_evidence(
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
    evidence_service: EvidenceService = Depends(_get_evidence_service),
):
    """View all evidence batches uploaded by a student."""
    await deps.student_service.ensure_student_access(admin, student_id)
    batches = await evidence_service.get_student_batches(student_id)
    return [EvidenceBatchResponse.model_validate(b) for b in batches]


@router.get(
    "/students/{student_id}/evidence/page", response_model=PageResponse[EvidenceBatchResponse]
)
async def get_student_evidence_page(
    student_id: uuid.UUID,
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
    evidence_service: EvidenceService = Depends(_get_evidence_service),
):
    await deps.student_service.ensure_student_access(admin, student_id)
    batches = await evidence_service.get_student_batches(
        student_id, limit=page_size, offset=(page - 1) * page_size
    )
    total = await evidence_service.repo.count_batches_by_user(student_id)
    return PageResponse.create(
        [EvidenceBatchResponse.model_validate(b) for b in batches], total, page, page_size
    )


@router.delete("/students/{student_id}/evidence/{batch_id}", status_code=204)
async def delete_student_evidence(
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
    evidence_service: EvidenceService = Depends(_get_evidence_service),
):
    """Delete an evidence batch uploaded by any student."""
    await deps.student_service.ensure_student_access(admin, student_id)
    await evidence_service.delete_student_batch(student_id, batch_id, admin.id)


@router.get("/students/{student_id}/certificate")
@limiter.limit("20/minute")
async def download_student_certificate(
    request: Request,
    student_id: uuid.UUID,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage_service),
):
    """Download the vaccination scheme certificate PDF for any student (admin only)."""
    await deps.student_service.ensure_student_access(admin, student_id)
    service = CertificateService(db, storage)
    pdf_buffer = await service.generate_certificate(
        student_id,
        requesting_admin_id=admin.id,
    )
    filename = "certificado_vacunacion.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ── Dose review ───────────────────────────────────────────────────────


@router.patch("/doses/{dose_id}/comment", response_model=MessageResponse)
async def update_dose_comment(
    dose_id: uuid.UUID,
    data: UpdateDoseCommentRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Update only the comment; preserve clinical and review state."""
    await deps.dose_review_service.update_comment(admin, dose_id, data.admin_notes)
    return {"message": "Comentario actualizado correctamente"}


@router.put("/doses/{dose_id}/review", response_model=MessageResponse)
async def review_dose(
    dose_id: uuid.UUID,
    data: ReviewDoseRequest,
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Admin approves or denies a specific dose."""
    await deps.dose_review_service.review_dose(admin, dose_id, data)
    return {"message": "Dosis revisada correctamente"}


# ── Admin account management ─────────────────────────────────────────


@router.get("/admins", response_model=list[UserResponse])
async def list_admins(
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """List normal administrators created by the application administrator."""
    admins = await deps.account_service.list_admins(app_admin)
    return [UserResponse.model_validate(admin) for admin in admins]


@router.post("/admins", response_model=UserResponse)
async def create_admin(
    data: CreateAdminRequest,
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Create a normal administrator scoped to one program and campus."""
    admin = await deps.account_service.create_admin(app_admin, data)
    return UserResponse.model_validate(admin)


@router.delete("/admins/{admin_id}", status_code=204)
async def delete_admin(
    admin_id: uuid.UUID,
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Delete a normal administrator."""
    await deps.account_service.delete_admin(app_admin, admin_id)


@router.get(
    "/certificate-signer-assignments",
    response_model=list[CertificateSignerAssignmentResponse],
)
async def list_certificate_signer_assignments(
    app_admin: User = Depends(require_role("app_admin")),
    db: AsyncSession = Depends(get_db),
):
    """List active and historical explicit certificate signer assignments."""
    assignments = await CertificateSignerAssignmentService(db).list_assignments()
    return [CertificateSignerAssignmentResponse.model_validate(row) for row in assignments]


@router.put(
    "/certificate-signer-assignments",
    response_model=CertificateSignerAssignmentResponse,
)
async def assign_certificate_signer(
    data: CertificateSignerAssignmentRequest,
    app_admin: User = Depends(require_role("app_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Set the unique responsible normal administrator for a program/campus pair."""
    assignment = await CertificateSignerAssignmentService(db).assign(
        app_admin,
        program=data.program,
        campus=data.campus,
        admin_id=data.admin_id,
    )
    return CertificateSignerAssignmentResponse.model_validate(assignment)


@router.get(
    "/certificate-signer-assignment-conflicts",
    response_model=list[CertificateSignerConflictResponse],
)
async def list_certificate_signer_assignment_conflicts(
    app_admin: User = Depends(require_role("app_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Report ambiguous legacy admin scopes; resolution is always explicit."""
    conflicts = await CertificateSignerAssignmentService(db).list_conflicts()
    return [CertificateSignerConflictResponse.model_validate(row) for row in conflicts]


# ── Statistics ────────────────────────────────────────────────────────


# ── Vaccine catalog (app_admin only) ──────────────────────────────────


@router.get("/vaccines", response_model=list[VaccineCatalogResponse])
async def list_vaccines(
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """List the full vaccine catalog (active and inactive)."""
    vaccines = await deps.vaccine_catalog_service.list_vaccines()
    return [VaccineCatalogResponse.model_validate(v) for v in vaccines]


@router.post("/vaccines", response_model=VaccineCatalogResponse)
async def create_vaccine(
    data: VaccineCreateRequest,
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Create a new vaccine in the catalog and regenerate active student schemes."""
    vaccine = await deps.vaccine_catalog_service.create_vaccine(app_admin, data)
    return VaccineCatalogResponse.model_validate(vaccine)


@router.put("/vaccines/{vaccine_id}", response_model=VaccineCatalogResponse)
async def update_vaccine(
    vaccine_id: uuid.UUID,
    data: VaccineUpdateRequest,
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Update a vaccine and regenerate active student schemes."""
    vaccine = await deps.vaccine_catalog_service.update_vaccine(app_admin, vaccine_id, data)
    return VaccineCatalogResponse.model_validate(vaccine)


@router.post("/vaccines/{vaccine_id}/deactivate", response_model=VaccineCatalogResponse)
async def deactivate_vaccine(
    vaccine_id: uuid.UUID,
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Deactivate a vaccine and regenerate active student schemes (drops it)."""
    vaccine = await deps.vaccine_catalog_service.deactivate_vaccine(app_admin, vaccine_id)
    return VaccineCatalogResponse.model_validate(vaccine)


@router.post("/vaccines/{vaccine_id}/reactivate", response_model=VaccineCatalogResponse)
async def reactivate_vaccine(
    vaccine_id: uuid.UUID,
    app_admin: User = Depends(require_role("app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Reactivate a vaccine and regenerate active student schemes (re-adds it)."""
    vaccine = await deps.vaccine_catalog_service.reactivate_vaccine(app_admin, vaccine_id)
    return VaccineCatalogResponse.model_validate(vaccine)


@router.get("/statistics", response_model=AdminStatisticsResponse)
async def get_statistics(
    semester: int | None = Query(None, ge=1, le=20),
    admin: User = Depends(require_role("admin", "app_admin")),
    deps: AdminDependencies = Depends(_get_deps),
):
    """Get aggregated statistics for the dashboard, optionally filtered by semester."""
    return await deps.report_service.get_statistics(admin, semester=semester)
