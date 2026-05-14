"""Admin vaccine catalog service.

CRUD over the vaccine catalog (Vaccine + VaccineDoseConfig). Each mutation
re-generates the scheme of every active student so they stay in sync with
the catalog, preserving applied_date by (vaccine_code, dose_number).

Restricted to app_admin in the router. Rules (VaccineRule JSON) are not
editable here — they remain seeded.
"""

import uuid

from app.common.enums import AuditAction
from app.core.exceptions import ConflictException, NotFoundException
from app.modules.admin.schemas import (
    VaccineCreateRequest,
    VaccineUpdateRequest,
)
from app.modules.audit.service import AuditService, build_change_details
from app.modules.users.models import User
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

    async def get_vaccine(self, vaccine_id: uuid.UUID) -> Vaccine:
        result = await self.db.execute(
            select(Vaccine)
            .where(Vaccine.id == vaccine_id)
            .options(selectinload(Vaccine.dose_configs))
        )
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

        affected = await self.scheme_service.regenerate_all_active_students(commit=False)
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
        return await self.get_vaccine(vaccine.id)

    async def update_vaccine(
        self,
        admin: User,
        vaccine_id: uuid.UUID,
        data: VaccineUpdateRequest,
    ) -> Vaccine:
        vaccine = await self.get_vaccine(vaccine_id)
        update_fields = data.model_dump(exclude={"dose_configs"}, exclude_unset=True)

        before = {key: getattr(vaccine, key) for key in update_fields}
        for key, value in update_fields.items():
            setattr(vaccine, key, value)

        if data.dose_configs is not None:
            existing_by_number = {config.dose_number: config for config in vaccine.dose_configs}
            new_numbers = {config.dose_number for config in data.dose_configs}

            # Delete configs whose dose_number is no longer present
            for number, config in existing_by_number.items():
                if number not in new_numbers:
                    await self.db.delete(config)

            # Update or create per dose_number (keeps PK so doses survive cascade)
            for new_config in data.dose_configs:
                existing = existing_by_number.get(new_config.dose_number)
                if existing is not None:
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

        changes = build_change_details(before, update_fields)
        # Expire cached relationships so regenerate sees the new dose_configs.
        self.db.expire(vaccine, ["dose_configs"])
        affected = await self.scheme_service.regenerate_all_active_students(commit=False)
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
        return await self.get_vaccine(vaccine.id)

    async def deactivate_vaccine(self, admin: User, vaccine_id: uuid.UUID) -> Vaccine:
        vaccine = await self.get_vaccine(vaccine_id)
        if not vaccine.is_active:
            return vaccine

        vaccine.is_active = False
        affected = await self.scheme_service.regenerate_all_active_students(commit=False)
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
        return vaccine

    async def reactivate_vaccine(self, admin: User, vaccine_id: uuid.UUID) -> Vaccine:
        vaccine = await self.get_vaccine(vaccine_id)
        if vaccine.is_active:
            return vaccine

        vaccine.is_active = True
        affected = await self.scheme_service.regenerate_all_active_students(commit=False)
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
        return vaccine
