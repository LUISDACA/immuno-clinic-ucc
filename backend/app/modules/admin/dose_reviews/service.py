"""Admin workflow for approving or denying student vaccine doses."""

import uuid

from app.common.access import ensure_student_in_admin_scope
from app.common.enums import AuditAction, DoseStatus, Role
from app.core.cache import invalidate_student_scheme
from app.core.exceptions import NotFoundException
from app.modules.audit.service import AuditService, audit_value
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.models import StudentVaccineDose
from app.modules.vaccination_scheme.schemas import ReviewDoseRequest
from app.modules.vaccination_scheme.service import SchemeService
from sqlalchemy.ext.asyncio import AsyncSession


class DoseReviewService:
    """Coordinates admin review side effects around the scheme domain service."""

    def __init__(
        self,
        db: AsyncSession,
        user_repo: UserRepository,
        scheme_service: SchemeService,
        audit: AuditService,
        notifications: NotificationService,
    ):
        self.db = db
        self.user_repo = user_repo
        self.scheme_service = scheme_service
        self.audit = audit
        self.notifications = notifications

    async def update_comment(self, admin: User, dose_id: uuid.UUID, notes: str | None) -> None:
        # Same row lock and scope as review, but no status/reviewer/date writes.
        dose = await self.scheme_service.scheme_repo.get_dose_by_id(dose_id)
        if dose is None:
            raise NotFoundException("Dose", str(dose_id))
        student_id = dose.student_vaccine.user_id
        student = await self.user_repo.get_by_id(student_id)
        if student is None or student.role != Role.STUDENT:
            raise NotFoundException("Student", str(student_id))
        ensure_student_in_admin_scope(admin, student)
        dose.admin_notes = notes
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.DOSE_COMMENT_UPDATED,
            target_type="student_vaccine_dose",
            target_id=dose_id,
            details={"student_id": str(student_id), "comment_removed": notes is None},
        )
        await self.db.commit()
        invalidate_student_scheme(student_id)

    async def review_dose(
        self,
        admin: User,
        dose_id: uuid.UUID,
        data: ReviewDoseRequest,
    ) -> StudentVaccineDose:
        current_dose = await self.scheme_service.scheme_repo.get_dose_by_id(dose_id)
        if current_dose is None:
            raise NotFoundException("Dose", str(dose_id))

        student_id = current_dose.student_vaccine.user_id
        student = await self.user_repo.get_by_id(student_id)
        if student is None or student.role != Role.STUDENT:
            raise NotFoundException("Student", str(student_id))
        ensure_student_in_admin_scope(admin, student)

        previous_status = current_dose.status
        dose = await self.scheme_service.review_dose(
            dose_id,
            admin.id,
            data,
            commit=False,
        )
        await self._log_review(admin, dose_id, dose, previous_status, data)

        if previous_status != data.status:
            title, message = self._review_notification_content(dose, data)
            await self.notifications.create_notification(
                dose.student_vaccine.user_id,
                title,
                message,
                category="review",
            )

        await self.db.commit()
        invalidate_student_scheme(student_id)
        return dose

    async def _log_review(
        self,
        admin: User,
        dose_id: uuid.UUID,
        dose: StudentVaccineDose,
        previous_status: DoseStatus,
        data: ReviewDoseRequest,
    ) -> None:
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.DOSE_REVIEWED,
            target_type="student_vaccine_dose",
            target_id=dose_id,
            details={
                "student_id": str(dose.student_vaccine.user_id),
                "vaccine": dose.student_vaccine.vaccine.name
                if dose.student_vaccine.vaccine
                else None,
                "dose": dose.dose_config.label if dose.dose_config else None,
                "old_status": audit_value(previous_status),
                "new_status": data.status.value,
                "notes": data.admin_notes,
            },
        )

    def _review_notification_content(
        self,
        dose: StudentVaccineDose,
        data: ReviewDoseRequest,
    ) -> tuple[str, str]:
        vaccine_name = (
            dose.student_vaccine.vaccine.name if dose.student_vaccine.vaccine else "Vacuna"
        )
        dose_label = dose.dose_config.label if dose.dose_config else "Dosis"

        if data.status == DoseStatus.APPROVED:
            return (
                "Dosis aprobada",
                f"Tu dosis '{dose_label}' de {vaccine_name} ha sido aprobada.",
            )

        if data.status == DoseStatus.IN_REVIEW:
            return ("Dosis en revisión", "El estado de una dosis se actualizó a en revisión.")

        reason = data.admin_notes or "Revisar detalles en el sistema"
        return (
            "Dosis rechazada",
            f"Tu dosis '{dose_label}' de {vaccine_name} ha sido rechazada. Motivo: {reason}.",
        )
