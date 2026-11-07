"""Vaccination scheme module — API router."""

import uuid

from app.common.enums import VaccineStatus
from app.core.cache import student_scheme_cache
from app.core.dependencies import get_current_active_user
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.rules import (
    clinical_today,
    due_info_by_dose,
    evaluate_scheme,
)
from app.modules.vaccination_scheme.schemas import (
    MessageResponse,
    SchemeEligibilityResponse,
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
    cached = student_scheme_cache.get(current_user.id)
    if cached is not None:
        return cached

    vaccines = await service.get_student_scheme(current_user.id)
    evaluation_date = clinical_today()
    evaluation = evaluate_scheme(vaccines, today=evaluation_date)
    approved_count = sum(1 for v in vaccines if v.status == VaccineStatus.APPROVED)

    response = SchemeOverviewResponse(
        total_vaccines=len(vaccines),
        approved_vaccines=approved_count,
        pending_vaccines=sum(1 for v in vaccines if v.status == VaccineStatus.PENDING),
        denied_vaccines=sum(1 for v in vaccines if v.status == VaccineStatus.DENIED),
        in_review_vaccines=sum(1 for v in vaccines if v.status == VaccineStatus.IN_REVIEW),
        is_up_to_date=evaluation.is_up_to_date,
        is_complete=evaluation.is_complete,
        is_certifiable=evaluation.is_certifiable,
        evaluated_on=evaluation_date,
        scheme_version=await service.current_scheme_version(current_user.id),
        vaccines=[_student_vaccine_response(v) for v in vaccines],
    )
    student_scheme_cache[current_user.id] = response
    return response


@router.get("/eligibility", response_model=SchemeEligibilityResponse)
async def get_my_scheme_eligibility(
    current_user: User = Depends(get_current_active_user),
    service: SchemeService = Depends(_get_scheme_service),
):
    """Return the backend-owned clinical signals for the current scheme."""
    evaluation_date = clinical_today()
    result = evaluate_scheme(
        await service.get_student_scheme(current_user.id),
        today=evaluation_date,
    )
    return SchemeEligibilityResponse(
        is_up_to_date=result.is_up_to_date,
        is_complete=result.is_complete,
        is_certifiable=result.is_certifiable,
        evaluated_on=evaluation_date,
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
        dose.is_overdue = due_info.is_overdue
        dose.is_due_today = due_info.is_due_today
    return response
