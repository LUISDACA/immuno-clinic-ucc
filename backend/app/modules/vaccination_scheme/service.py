"""Vaccination scheme module — core business logic service.

This is the HEART of the domain: vaccine assignment, dose generation,
status recalculation, and sex-based rule enforcement.
"""

import uuid
from datetime import datetime, timezone

from app.common.enums import AppliesTo, AuditAction, DoseStatus, Gender, Role, VaccineStatus
from app.core.cache import invalidate_student_scheme, invalidate_student_scheme_all
from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.modules.audit.service import AuditService, build_change_details
from app.modules.users.models import Profile, User
from app.modules.vaccination_scheme.models import (
    StudentSchemeVersion,
    StudentVaccine,
    StudentVaccineDose,
)
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.rules import (
    vaccine_status_from_certificate_rules,
    validate_application_date,
)
from app.modules.vaccination_scheme.schemas import ReviewDoseRequest, UpdateDoseRequest
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload


class SchemeService:
    """Vaccination scheme business logic — source of truth for domain rules."""

    def __init__(self, scheme_repo: SchemeRepository, vaccine_repo: VaccineRepository):
        self.scheme_repo = scheme_repo
        self.vaccine_repo = vaccine_repo
        self.audit = AuditService(scheme_repo.db)

    # ── Query operations ──────────────────────────────────────────────

    async def get_student_scheme(self, user_id: uuid.UUID) -> list[StudentVaccine]:
        """Read the current scheme without creating clinical state transitions."""
        return await self.scheme_repo.get_student_vaccines(user_id)

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

        await self.append_scheme_version(user_id, "initial-assignment")
        if commit:
            await self.scheme_repo.commit()
            invalidate_student_scheme(user_id)
        return assigned

    # ── Scheme regeneration (sex change) ──────────────────────────────

    async def regenerate_scheme_for_sex_change(
        self,
        user_id: uuid.UUID,
        new_sex: Gender,
        *,
        commit: bool = True,
        before_recorded: bool = False,
        created_by: uuid.UUID | None = None,
    ) -> list[StudentVaccine]:
        """Reconcile to the current catalog while retaining all old assignment rows."""
        if not before_recorded:
            await self.append_scheme_version(
                user_id,
                "profile:reconciliation:before",
                created_by=created_by,
            )
        return await self.reconcile_student_scheme(
            user_id,
            new_sex,
            reason="profile:sex-change",
            created_by=created_by,
            commit=commit,
        )

    async def reconcile_student_scheme(
        self,
        user_id: uuid.UUID,
        sex: Gender,
        *,
        reason: str,
        created_by: uuid.UUID | None = None,
        commit: bool = True,
    ) -> list[StudentVaccine]:
        vaccines = await self.vaccine_repo.get_active_vaccines()
        vaccine_by_id = {vaccine.id: vaccine for vaccine in vaccines}
        result = await self.scheme_repo.db.execute(
            select(StudentVaccine)
            .where(StudentVaccine.user_id == user_id)
            .options(joinedload(StudentVaccine.vaccine))
            .with_for_update(of=StudentVaccine)
        )
        assignments = list(result.unique().scalars().all())
        assignment_by_vaccine = {item.vaccine_id: item for item in assignments}

        for vaccine in vaccines:
            assignment = assignment_by_vaccine.get(vaccine.id)
            applies = self._vaccine_applies_to_sex(vaccine, sex)
            if assignment is None:
                if not applies:
                    continue
                assignment = StudentVaccine(
                    user_id=user_id,
                    vaccine_id=vaccine.id,
                    status=VaccineStatus.IN_REVIEW,
                    is_active=True,
                )
                self.scheme_repo.db.add(assignment)
                await self.scheme_repo.db.flush()
                assignments.append(assignment)
                assignment_by_vaccine[vaccine.id] = assignment
            assignment.is_active = applies

            dose_result = await self.scheme_repo.db.execute(
                select(StudentVaccineDose)
                .where(StudentVaccineDose.student_vaccine_id == assignment.id)
                .options(joinedload(StudentVaccineDose.dose_config))
                .with_for_update(of=StudentVaccineDose)
            )
            doses = list(dose_result.unique().scalars().all())
            by_config = {dose.dose_config_id: dose for dose in doses}
            applicable_configs = {
                config.id: config
                for config in vaccine.dose_configs
                if self._dose_config_applies_to_sex(config, sex)
            }
            for dose in doses:
                dose.is_active = applies and dose.dose_config_id in applicable_configs
            for config_id, config in applicable_configs.items():
                if config_id not in by_config:
                    new_dose = StudentVaccineDose(
                        student_vaccine_id=assignment.id,
                        dose_config_id=config_id,
                        dose_number=config.dose_number,
                        status=DoseStatus.IN_REVIEW,
                        is_active=applies,
                    )
                    self.scheme_repo.db.add(new_dose)
                    doses.append(new_dose)
            assignment.status = self.recalculate_vaccine_status(
                [dose for dose in doses if dose.is_active]
            )

        for assignment in assignments:
            if assignment.vaccine_id not in vaccine_by_id:
                assignment.is_active = False
        await self.scheme_repo.db.flush()
        if commit:
            await self.append_scheme_version(user_id, reason, created_by=created_by)
            await self.scheme_repo.commit()
            invalidate_student_scheme(user_id)
        return await self.scheme_repo.get_student_vaccines(user_id)

    async def append_scheme_version(
        self,
        user_id: uuid.UUID,
        reason: str,
        *,
        created_by: uuid.UUID | None = None,
    ) -> StudentSchemeVersion:
        """Append an immutable clinical snapshot before or after reconciliation."""
        await self.scheme_repo.db.execute(
            select(User.id).where(User.id == user_id).with_for_update()
        )
        current = await self.scheme_repo.get_student_vaccines(user_id)
        profile = await self.scheme_repo.db.scalar(
            select(Profile).where(Profile.user_id == user_id)
        )
        latest = await self.scheme_repo.db.scalar(
            select(func.max(StudentSchemeVersion.version_number)).where(
                StudentSchemeVersion.user_id == user_id
            )
        )
        snapshot = {
            "profile": {
                "sex": profile.sex.value if profile else None,
                "program": profile.program if profile else None,
                "campus": profile.campus if profile else None,
            },
            "vaccines": [
                {
                    "assignment_id": str(vaccine.id),
                    "vaccine_id": str(vaccine.vaccine_id),
                    "code": vaccine.vaccine.code if vaccine.vaccine else None,
                    "name": vaccine.vaccine.name if vaccine.vaccine else None,
                    "is_annual": vaccine.vaccine.is_annual if vaccine.vaccine else None,
                    "rules": [
                        {
                            "rule_type": rule.rule_type,
                            "rule_config": rule.rule_config,
                            "description": rule.description,
                        }
                        for rule in (vaccine.vaccine.rules or [])
                    ]
                    if vaccine.vaccine
                    else [],
                    "status": vaccine.status.value,
                    "doses": [
                        {
                            "id": str(dose.id),
                            "dose_number": dose.dose_number,
                            "config_id": str(dose.dose_config_id),
                            "label": dose.dose_config.label if dose.dose_config else None,
                            "dose_type": (
                                dose.dose_config.dose_type.value if dose.dose_config else None
                            ),
                            "is_required": (
                                dose.dose_config.is_required if dose.dose_config else None
                            ),
                            "applied_date": (
                                dose.applied_date.isoformat() if dose.applied_date else None
                            ),
                            "titer_value": dose.titer_value,
                            "status": dose.status.value,
                            "admin_notes": dose.admin_notes,
                            "reviewed_by": str(dose.reviewed_by) if dose.reviewed_by else None,
                            "reviewed_at": dose.reviewed_at.isoformat()
                            if dose.reviewed_at
                            else None,
                        }
                        for dose in vaccine.doses
                    ],
                }
                for vaccine in current
            ],
        }
        row = StudentSchemeVersion(
            user_id=user_id,
            version_number=(latest or 0) + 1,
            reason=reason[:80],
            snapshot=snapshot,
            created_by=created_by,
        )
        self.scheme_repo.db.add(row)
        await self.scheme_repo.db.flush()
        return row

    async def append_versions_for_active_students(
        self,
        reason: str,
        *,
        created_by: uuid.UUID | None = None,
    ) -> int:
        result = await self.scheme_repo.db.execute(
            select(User.id)
            .where(User.is_active.is_(True), User.role == Role.STUDENT)
            .order_by(User.id)
        )
        user_ids = list(result.scalars().all())
        for user_id in user_ids:
            await self.append_scheme_version(user_id, reason, created_by=created_by)
        return len(user_ids)

    async def current_scheme_version(self, user_id: uuid.UUID) -> int:
        version = await self.scheme_repo.db.scalar(
            select(func.max(StudentSchemeVersion.version_number)).where(
                StudentSchemeVersion.user_id == user_id
            )
        )
        return version or 0

    async def regenerate_all_active_students(self, *, commit: bool = True) -> int:
        """Re-sync the scheme of every active student to the current catalog.

        Reuses the sex-change regeneration path: deletes the student's scheme
        and re-creates it from active vaccines, preserving applied_date and
        titer_value by (vaccine_code, dose_number) where the dose still exists.
        """
        result = await self.scheme_repo.db.execute(
            select(User).join(Profile).where(User.is_active.is_(True), User.role == Role.STUDENT)
        )
        users = list(result.scalars().all())

        for user in users:
            if user.profile is None:
                continue
            await self.append_scheme_version(user.id, "catalog:reconcile:before")
            await self.reconcile_student_scheme(
                user.id,
                user.profile.sex,
                reason="catalog:reconcile:after",
                commit=False,
            )
            await self.append_scheme_version(user.id, "catalog:reconcile:after")

        if commit:
            await self.scheme_repo.commit()
            invalidate_student_scheme_all()
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

        try:
            validate_application_date(data.applied_date)
        except ValueError as exc:
            raise ConflictException(str(exc)) from exc

        if dose.status == DoseStatus.APPROVED and any(
            field in data.model_fields_set and getattr(data, field) != getattr(dose, field)
            for field in ("applied_date", "titer_value")
        ):
            raise ConflictException(
                "La dosis está aprobada. Un administrador debe reabrir su revisión antes de editarla."
            )

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
            applied_date_was_updated or titer_value_was_updated
        ) and dose.status == DoseStatus.DENIED:
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
            invalidate_student_scheme(user_id)
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
        student_user_id = sv.user_id if sv else None
        if sv:
            sv.status = self.recalculate_vaccine_status(sv.doses)
            sv.reviewed_by = admin_id
            sv.reviewed_at = datetime.now(timezone.utc)

        if commit:
            await self.scheme_repo.commit()
            if student_user_id is not None:
                invalidate_student_scheme(student_user_id)
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
        - Otherwise → vaccine in_review (the report label may be PENDING)
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
