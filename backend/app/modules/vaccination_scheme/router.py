"""Vaccination scheme module — API router."""

import uuid

from app.common.enums import VaccineStatus
from app.core.dependencies import get_current_active_user
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.rules import (
    certificate_initial_dose_complete,
    certificate_overdue_doses,
    due_info_by_dose,
)
from app.modules.vaccination_scheme.schemas import (
    MessageResponse,
    SchemeOverviewResponse,
    StudentVaccineResponse,
    UpdateDoseRequest,
)
from app.modules.vaccination_scheme.service import SchemeService
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/scheme", tags=["Vaccination Scheme"])


def _get_scheme_service(db: AsyncSession = Depends(get_db)) -> SchemeService:
    return SchemeService(SchemeRepository(db), VaccineRepository(db))


@router.get("/", response_model=SchemeOverviewResponse)
async def get_my_scheme(
    current_user: User = Depends(get_current_active_user),
    service: SchemeService = Depends(_get_scheme_service),
):
    """Get the current student's full vaccination scheme with overview stats."""
    vaccines = await service.get_student_scheme(current_user.id)
    approved_count = sum(1 for v in vaccines if _vaccine_current_for_certificate(v))

    return SchemeOverviewResponse(
        total_vaccines=len(vaccines),
        approved_vaccines=approved_count,
        pending_vaccines=sum(
            1
            for v in vaccines
            if not _vaccine_current_for_certificate(v) and v.status == VaccineStatus.PENDING
        ),
        denied_vaccines=sum(1 for v in vaccines if v.status == VaccineStatus.DENIED),
        in_review_vaccines=sum(1 for v in vaccines if v.status == VaccineStatus.IN_REVIEW),
        vaccines=[_student_vaccine_response(v) for v in vaccines],
    )


def _vaccine_current_for_certificate(student_vaccine) -> bool:
    return certificate_initial_dose_complete(student_vaccine) and not certificate_overdue_doses(
        student_vaccine
    )


@router.put("/doses/{dose_id}", response_model=MessageResponse)
async def update_dose_date(
    dose_id: uuid.UUID,
    data: UpdateDoseRequest,
    current_user: User = Depends(get_current_active_user),
    service: SchemeService = Depends(_get_scheme_service),
):
    """Student sets the applied date for a specific dose."""
    await service.update_dose(dose_id, current_user.id, data)
    return {"message": "Dosis actualizada correctamente"}


def _student_vaccine_response(student_vaccine) -> StudentVaccineResponse:
    response = StudentVaccineResponse.model_validate(student_vaccine)
    due_by_dose = due_info_by_dose(student_vaccine)
    for dose in response.doses:
        due_info = due_by_dose.get(dose.id)
        if due_info is None:
            continue
        dose.due_date = due_info.due_date
        dose.days_until_due = due_info.days_until_due
    return response
