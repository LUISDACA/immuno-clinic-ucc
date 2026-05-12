"""Vaccination scheme module — core business logic service.

This is the HEART of the domain: vaccine assignment, dose generation,
status recalculation, and sex-based rule enforcement.
"""

import uuid
from datetime import datetime, timezone

from app.common.enums import AppliesTo, AuditAction, DoseStatus, Gender, Role, VaccineStatus
from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.audit.service import AuditService, build_change_details
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.rules import (
    certificate_overdue_doses,
    vaccine_status_from_certificate_rules,
)
from app.modules.vaccination_scheme.schemas import ReviewDoseRequest, UpdateDoseRequest
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig


class SchemeService:
    """Vaccination scheme business logic — source of truth for domain rules."""

    def __init__(self, scheme_repo: SchemeRepository, vaccine_repo: VaccineRepository):
        self.scheme_repo = scheme_repo
        self.vaccine_repo = vaccine_repo
        self.audit = AuditService(scheme_repo.db)

    # ── Query operations ──────────────────────────────────────────────

    async def get_student_scheme(self, user_id: uuid.UUID) -> list[StudentVaccine]:
        """Get the full vaccination scheme for a student.

        Auto-denies any pending doses whose calculated due date has already
        passed, so both the student and admin always see up-to-date status.
        """
        vaccines = await self.scheme_repo.get_student_vaccines(user_id)
        any_changed = False
        for sv in vaccines:
            sv_changed = False
            for due_info in certificate_overdue_doses(sv):
                dose = next((d for d in sv.doses if d.id == due_info.dose_id), None)
                if dose is None or dose.status == DoseStatus.DENIED:
                    continue
                dose.status = DoseStatus.DENIED
                sv_changed = True
                any_changed = True
            if sv_changed:
                sv.status = self.recalculate_vaccine_status(sv.doses)
        if any_changed:
            await self.scheme_repo.commit()
        return vaccines

    # ── Vaccine assignment ────────────────────────────────────────────

    async def assign_vaccines_to_student(
        self,
        user_id: uuid.UUID,
        sex: Gender,
        *,
        commit: bool = True,
    ) -> list[StudentVaccine]:
        """
        Assign all active vaccines to a student and generate dose records
        based on the vaccine catalog and the student's sex.
        """
        vaccines = await self.vaccine_repo.get_active_vaccines()
        assigned = []

        for vaccine in vaccines:
            # Check if vaccine applies to this sex
            if not self._vaccine_applies_to_sex(vaccine, sex):
                continue

            sv = StudentVaccine(
                user_id=user_id,
                vaccine_id=vaccine.id,
                status=VaccineStatus.PENDING,
            )
            sv = await self.scheme_repo.create_student_vaccine(sv)

            # Generate doses based on config and sex
            doses = self._generate_doses_for_vaccine(sv.id, vaccine, sex)
            for dose in doses:
                await self.scheme_repo.create_dose(dose)

            assigned.append(sv)

        if commit:
            await self.scheme_repo.commit()
        return assigned

    # ── Scheme regeneration (sex change) ──────────────────────────────

    async def regenerate_scheme_for_sex_change(
        self,
        user_id: uuid.UUID,
        new_sex: Gender,
        *,
        commit: bool = True,
    ) -> list[StudentVaccine]:
        """
        Regenerate the entire vaccination scheme when a student's sex changes.
        Preserves applied_date data where doses still apply.
        """
        # Get current scheme to preserve data
        current_scheme = await self.scheme_repo.get_student_vaccines(user_id)
        preserved_dates: dict[str, dict] = {}

        for sv in current_scheme:
            vaccine_code = sv.vaccine.code if sv.vaccine else ""
            for dose in sv.doses:
                key = f"{vaccine_code}_{dose.dose_number}"
                preserved_dates[key] = {
                    "applied_date": dose.applied_date,
                    "titer_value": dose.titer_value,
                }

        # Delete current scheme
        await self.scheme_repo.delete_student_vaccines(user_id)

        # Re-assign with new sex rules
        vaccines = await self.vaccine_repo.get_active_vaccines()
        assigned = []

        for vaccine in vaccines:
            if not self._vaccine_applies_to_sex(vaccine, new_sex):
                continue

            sv = StudentVaccine(
                user_id=user_id,
                vaccine_id=vaccine.id,
                status=VaccineStatus.PENDING,
            )
            sv = await self.scheme_repo.create_student_vaccine(sv)

            doses = self._generate_doses_for_vaccine(sv.id, vaccine, new_sex)
            for dose in doses:
                # Restore preserved dates if they exist
                key = f"{vaccine.code}_{dose.dose_number}"
                if key in preserved_dates:
                    dose.applied_date = preserved_dates[key]["applied_date"]
                    dose.titer_value = preserved_dates[key]["titer_value"]
                await self.scheme_repo.create_dose(dose)

            assigned.append(sv)

        if commit:
            await self.scheme_repo.commit()
        return assigned

    async def regenerate_all_active_students(self, *, commit: bool = True) -> int:
        """Re-sync the scheme of every active student to the current catalog.

        Reuses the sex-change regeneration path: deletes the student's scheme
        and re-creates it from active vaccines, preserving applied_date and
        titer_value by (vaccine_code, dose_number) where the dose still exists.
        """
        from sqlalchemy import select

        from app.modules.users.models import Profile, User

        result = await self.scheme_repo.db.execute(
            select(User).join(Profile).where(User.is_active.is_(True), User.role == Role.STUDENT)
        )
        users = list(result.scalars().all())

        for user in users:
            if user.profile is None:
                continue
            await self.regenerate_scheme_for_sex_change(
                user.id,
                user.profile.sex,
                commit=False,
            )

        if commit:
            await self.scheme_repo.commit()
        return len(users)

    # ── Student: update dose date ─────────────────────────────────────

    async def update_dose(
        self,
        dose_id: uuid.UUID,
        user_id: uuid.UUID,
        data: UpdateDoseRequest,
        *,
        commit: bool = True,
    ) -> StudentVaccineDose:
        """Student sets the applied_date and/or titer_value for a dose."""
        dose = await self.scheme_repo.get_dose_by_id(dose_id)
        if dose is None:
            raise NotFoundException("Dose", str(dose_id))

        # Verify ownership
        if dose.student_vaccine.user_id != user_id:
            raise ForbiddenException("You can only update your own doses")

        applied_date_was_updated = "applied_date" in data.model_fields_set
        titer_value_was_updated = "titer_value" in data.model_fields_set
        before = {
            "applied_date": dose.applied_date,
            "titer_value": dose.titer_value,
        }

        if applied_date_was_updated:
            dose.applied_date = data.applied_date
        if titer_value_was_updated:
            dose.titer_value = data.titer_value

        if (
            (applied_date_was_updated or titer_value_was_updated)
            and dose.applied_date is not None
            and dose.status == DoseStatus.DENIED
        ):
            dose.status = DoseStatus.IN_REVIEW
            dose.admin_notes = None
            dose.reviewed_by = None
            dose.reviewed_at = None

            sv = await self.scheme_repo.get_student_vaccine(dose.student_vaccine_id)
            if sv:
                sv.status = self.recalculate_vaccine_status(sv.doses)
                sv.admin_notes = None
                sv.reviewed_by = None
                sv.reviewed_at = None

        after = {
            "applied_date": dose.applied_date,
            "titer_value": dose.titer_value,
        }
        changes = build_change_details(before, after)
        if changes:
            await self.audit.log(
                actor_id=user_id,
                action=AuditAction.DOSE_UPDATED,
                target_type="student_vaccine_dose",
                target_id=dose_id,
                details={
                    "student_id": str(user_id),
                    "vaccine": dose.student_vaccine.vaccine.name
                    if dose.student_vaccine.vaccine
                    else None,
                    "dose": dose.dose_config.label if dose.dose_config else None,
                    "changes": changes,
                },
            )

        if commit:
            await self.scheme_repo.commit()
        return dose

    # ── Admin: review dose ────────────────────────────────────────────

    async def review_dose(
        self,
        dose_id: uuid.UUID,
        admin_id: uuid.UUID,
        data: ReviewDoseRequest,
        *,
        commit: bool = True,
    ) -> StudentVaccineDose:
        """Admin approves or denies a specific dose, then recalculates vaccine status."""
        dose = await self.scheme_repo.get_dose_by_id(dose_id)
        if dose is None:
            raise NotFoundException("Dose", str(dose_id))

        dose.status = data.status
        dose.admin_notes = data.admin_notes
        dose.reviewed_by = admin_id
        dose.reviewed_at = datetime.now(timezone.utc)

        # Recalculate parent vaccine status
        sv = await self.scheme_repo.get_student_vaccine(dose.student_vaccine_id)
        if sv:
            sv.status = self.recalculate_vaccine_status(sv.doses)
            sv.reviewed_by = admin_id
            sv.reviewed_at = datetime.now(timezone.utc)

        if commit:
            await self.scheme_repo.commit()
        return dose

    # ── Domain rule: status recalculation ─────────────────────────────

    @staticmethod
    def recalculate_vaccine_status(doses: list[StudentVaccineDose]) -> VaccineStatus:
        """
        Recalculate vaccine aggregate status from its individual doses.

        Rules (validated from v1):
        - All required doses approved → vaccine approved
        - Any dose denied → vaccine denied
        - Any dose in_review and none denied → vaccine in_review
        - Otherwise → vaccine pending
        """
        return vaccine_status_from_certificate_rules(doses)

    # ── Private helpers ───────────────────────────────────────────────

    @staticmethod
    def _vaccine_applies_to_sex(vaccine: Vaccine, sex: Gender) -> bool:
        """Check if a vaccine applies to a given sex."""
        if vaccine.applies_to == AppliesTo.ALL:
            return True
        if vaccine.applies_to == AppliesTo.MALE and sex == Gender.MALE:
            return True
        return vaccine.applies_to == AppliesTo.FEMALE and sex == Gender.FEMALE

    @staticmethod
    def _dose_config_applies_to_sex(config: VaccineDoseConfig, sex: Gender) -> bool:
        """Check if a specific dose config applies to a given sex."""
        if config.applies_to == AppliesTo.ALL:
            return True
        if config.applies_to == AppliesTo.MALE and sex == Gender.MALE:
            return True
        return config.applies_to == AppliesTo.FEMALE and sex == Gender.FEMALE

    def _generate_doses_for_vaccine(
        self,
        student_vaccine_id: uuid.UUID,
        vaccine: Vaccine,
        sex: Gender,
    ) -> list[StudentVaccineDose]:
        """Generate dose records from vaccine config filtered by student sex."""
        doses = []
        for config in vaccine.dose_configs:
            if not self._dose_config_applies_to_sex(config, sex):
                continue

            dose = StudentVaccineDose(
                student_vaccine_id=student_vaccine_id,
                dose_config_id=config.id,
                dose_number=config.dose_number,
                status=DoseStatus.PENDING,
            )
            doses.append(dose)
        return doses
