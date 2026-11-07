"""Admin vaccine catalog service.

CRUD over the vaccine catalog (Vaccine + VaccineDoseConfig). Each mutation reconciles only the affected vaccine for active students.
Retired assignments and doses are archived, never deleted.

Restricted to app_admin in the router. Rules (VaccineRule JSON) are not
editable here — they remain seeded.
"""

import uuid

from app.common.enums import AuditAction, Role
from app.core.cache import invalidate_student_scheme_all
from app.core.exceptions import ConflictException, NotFoundException
from app.modules.admin.schemas import (
    VaccineCreateRequest,
    VaccineUpdateRequest,
)
from app.modules.audit.service import AuditService, build_change_details
from app.modules.users.models import User
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.service import SchemeService
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class VaccineCatalogService:
    """CRUD operations for the vaccine catalog."""

    def __init__(
        self,
        db: AsyncSession,
        scheme_service: SchemeService,
        audit: AuditService,
    ):
        self.db = db
        self.scheme_service = scheme_service
        self.audit = audit

    async def list_vaccines(self) -> list[Vaccine]:
        result = await self.db.execute(
            select(Vaccine)
            .options(selectinload(Vaccine.dose_configs))
            .order_by(Vaccine.display_order, Vaccine.name)
        )
        return list(result.scalars().all())

    async def get_vaccine(self, vaccine_id: uuid.UUID, *, for_update: bool = False) -> Vaccine:
        query = (
            select(Vaccine)
            .where(Vaccine.id == vaccine_id)
            .options(selectinload(Vaccine.dose_configs))
        )
        if for_update:
            query = query.with_for_update(of=Vaccine).execution_options(populate_existing=True)
        result = await self.db.execute(query)
        vaccine = result.scalar_one_or_none()
        if vaccine is None:
            raise NotFoundException("Vaccine", str(vaccine_id))
        return vaccine

    async def create_vaccine(
        self,
        admin: User,
        data: VaccineCreateRequest,
    ) -> Vaccine:
        existing = await self.db.execute(select(Vaccine).where(Vaccine.code == data.code))
        if existing.scalar_one_or_none():
            raise ConflictException(f"Ya existe una vacuna con el código {data.code}")

        await self.scheme_service.append_versions_for_active_students(
            "catalog:create:before",
            created_by=admin.id,
        )

        vaccine = Vaccine(
            name=data.name,
            code=data.code,
            base_doses=data.base_doses,
            has_booster=data.has_booster,
            has_titer=data.has_titer,
            has_titer_value=data.has_titer_value,
            is_annual=data.is_annual,
            applies_to=data.applies_to,
            display_order=data.display_order,
            is_active=True,
        )
        self.db.add(vaccine)
        await self.db.flush()

        for config in data.dose_configs:
            self.db.add(
                VaccineDoseConfig(
                    vaccine_id=vaccine.id,
                    dose_number=config.dose_number,
                    label=config.label,
                    is_required=config.is_required,
                    applies_to=config.applies_to,
                    dose_type=config.dose_type,
                )
            )
        await self.db.flush()

        affected = await self._sync_assignments(vaccine)
        await self.scheme_service.append_versions_for_active_students(
            "catalog:create:after",
            created_by=admin.id,
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.VACCINE_CREATED,
            target_type="vaccine",
            target_id=vaccine.id,
            details={
                "code": vaccine.code,
                "name": vaccine.name,
                "dose_config_count": len(data.dose_configs),
                "students_regenerated": affected,
            },
        )
        await self.db.commit()
        invalidate_student_scheme_all()
        return await self.get_vaccine(vaccine.id)

    async def update_vaccine(
        self,
        admin: User,
        vaccine_id: uuid.UUID,
        data: VaccineUpdateRequest,
    ) -> Vaccine:
        vaccine = await self.get_vaccine(vaccine_id, for_update=True)
        await self.scheme_service.append_versions_for_active_students(
            "catalog:update:before",
            created_by=admin.id,
        )
        update_fields = data.model_dump(exclude={"dose_configs"}, exclude_unset=True)

        before = {key: getattr(vaccine, key) for key in update_fields}
        if data.dose_configs is not None:
            configs = await self.db.execute(
                select(VaccineDoseConfig).where(VaccineDoseConfig.vaccine_id == vaccine.id)
            )
            existing_by_number = {config.dose_number: config for config in configs.scalars()}
            for new_config in data.dose_configs:
                old = existing_by_number.get(new_config.dose_number)
                if old is not None and old.dose_type != new_config.dose_type:
                    referenced = await self.db.scalar(
                        select(StudentVaccineDose.id)
                        .where(StudentVaccineDose.dose_config_id == old.id)
                        .limit(1)
                    )
                    if referenced is not None:
                        raise ConflictException(
                            "No se puede reinterpretar una dosis asignada; crea una nueva dosis para el nuevo tipo clínico"
                        )
            new_numbers = {config.dose_number for config in data.dose_configs}

            # Archive configs whose dose_number is no longer present.
            for number, config in existing_by_number.items():
                if number not in new_numbers:
                    config.is_active = False

            # Update or create per dose_number (keeps PK so doses survive cascade)
            for new_config in data.dose_configs:
                existing = existing_by_number.get(new_config.dose_number)
                if existing is not None:
                    existing.is_active = True
                    existing.label = new_config.label
                    existing.is_required = new_config.is_required
                    existing.applies_to = new_config.applies_to
                    existing.dose_type = new_config.dose_type
                else:
                    self.db.add(
                        VaccineDoseConfig(
                            vaccine_id=vaccine.id,
                            dose_number=new_config.dose_number,
                            label=new_config.label,
                            is_required=new_config.is_required,
                            applies_to=new_config.applies_to,
                            dose_type=new_config.dose_type,
                        )
                    )
            await self.db.flush()

        for key, value in update_fields.items():
            setattr(vaccine, key, value)
        await self.db.flush()
        changes = build_change_details(before, update_fields)
        # Expire cached relationships so synchronization sees the new configs.
        self.db.expire(vaccine, ["dose_configs"])
        affected = await self._sync_assignments(vaccine)
        await self.scheme_service.append_versions_for_active_students(
            "catalog:update:after",
            created_by=admin.id,
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.VACCINE_UPDATED,
            target_type="vaccine",
            target_id=vaccine.id,
            details={
                "code": vaccine.code,
                "changes": changes,
                "dose_configs_replaced": data.dose_configs is not None,
                "students_regenerated": affected,
            },
        )
        await self.db.commit()
        invalidate_student_scheme_all()
        return await self.get_vaccine(vaccine.id)

    async def deactivate_vaccine(self, admin: User, vaccine_id: uuid.UUID) -> Vaccine:
        vaccine = await self.get_vaccine(vaccine_id, for_update=True)
        if not vaccine.is_active:
            return vaccine

        await self.scheme_service.append_versions_for_active_students(
            "catalog:deactivate:before",
            created_by=admin.id,
        )

        vaccine.is_active = False
        affected = await self._sync_assignments(vaccine)
        await self.scheme_service.append_versions_for_active_students(
            "catalog:deactivate:after",
            created_by=admin.id,
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.VACCINE_DEACTIVATED,
            target_type="vaccine",
            target_id=vaccine.id,
            details={
                "code": vaccine.code,
                "students_regenerated": affected,
            },
        )
        await self.db.commit()
        invalidate_student_scheme_all()
        return vaccine

    async def reactivate_vaccine(self, admin: User, vaccine_id: uuid.UUID) -> Vaccine:
        vaccine = await self.get_vaccine(vaccine_id, for_update=True)
        if vaccine.is_active:
            return vaccine

        await self.scheme_service.append_versions_for_active_students(
            "catalog:reactivate:before",
            created_by=admin.id,
        )

        vaccine.is_active = True
        affected = await self._sync_assignments(vaccine)
        await self.scheme_service.append_versions_for_active_students(
            "catalog:reactivate:after",
            created_by=admin.id,
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.VACCINE_REACTIVATED,
            target_type="vaccine",
            target_id=vaccine.id,
            details={
                "code": vaccine.code,
                "students_regenerated": affected,
            },
        )
        await self.db.commit()
        invalidate_student_scheme_all()
        return vaccine

    async def _sync_assignments(self, vaccine: Vaccine) -> int:
        """Reconcile one catalog entry, retaining all historical rows and reviews."""
        await self.db.flush()
        configs = list(
            (
                await self.db.scalars(
                    select(VaccineDoseConfig).where(
                        VaccineDoseConfig.vaccine_id == vaccine.id,
                        VaccineDoseConfig.is_active.is_(True),
                    )
                )
            ).all()
        )
        users = list(
            (
                await self.db.scalars(
                    select(User).where(User.is_active.is_(True), User.role == Role.STUDENT)
                )
            ).all()
        )
        for user in users:
            if user.profile is None:
                continue
            assignment = await self.db.scalar(
                select(StudentVaccine).where(
                    StudentVaccine.user_id == user.id, StudentVaccine.vaccine_id == vaccine.id
                )
            )
            applicable = vaccine.is_active and self.scheme_service._vaccine_applies_to_sex(
                vaccine, user.profile.sex
            )
            if assignment is None:
                if not applicable:
                    continue
                assignment = StudentVaccine(user_id=user.id, vaccine_id=vaccine.id)
                self.db.add(assignment)
                await self.db.flush()
            assignment.is_active = applicable
            doses = list(
                (
                    await self.db.scalars(
                        select(StudentVaccineDose).where(
                            StudentVaccineDose.student_vaccine_id == assignment.id
                        )
                    )
                ).all()
            )
            by_config = {dose.dose_config_id: dose for dose in doses}
            applicable_configs = {
                config.id: config
                for config in configs
                if self.scheme_service._dose_config_applies_to_sex(config, user.profile.sex)
            }
            for dose in doses:
                dose.is_active = dose.dose_config_id in applicable_configs
            for config_id, config in applicable_configs.items():
                if config_id not in by_config:
                    self.db.add(
                        StudentVaccineDose(
                            student_vaccine_id=assignment.id,
                            dose_config_id=config_id,
                            dose_number=config.dose_number,
                        )
                    )
            await self.db.flush()
            # Refresh the filtered relationship; never replace or delete its rows.
            await self.db.refresh(assignment, ["doses"])
            assignment.status = self.scheme_service.recalculate_vaccine_status(assignment.doses)
        return len(users)
