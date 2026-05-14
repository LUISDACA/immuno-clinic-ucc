"""Vaccination scheme module — repository."""

import uuid

from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccines.models import Vaccine
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload


class VaccineRepository:
    """Data access for the vaccine catalog."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_active_vaccines(self) -> list[Vaccine]:
        result = await self.db.execute(
            select(Vaccine)
            .where(Vaccine.is_active.is_(True))
            .options(selectinload(Vaccine.dose_configs), selectinload(Vaccine.rules))
            .order_by(Vaccine.display_order)
        )
        return list(result.scalars().all())

    async def get_vaccine_by_id(self, vaccine_id: uuid.UUID) -> Vaccine | None:
        result = await self.db.execute(
            select(Vaccine)
            .where(Vaccine.id == vaccine_id)
            .options(selectinload(Vaccine.dose_configs), selectinload(Vaccine.rules))
        )
        return result.scalar_one_or_none()


class SchemeRepository:
    """Data access for student vaccination scheme."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_student_vaccines(self, user_id: uuid.UUID) -> list[StudentVaccine]:
        result = await self.db.execute(
            select(StudentVaccine)
            .where(StudentVaccine.user_id == user_id)
            .options(
                joinedload(StudentVaccine.vaccine).selectinload(Vaccine.dose_configs),
                selectinload(StudentVaccine.doses).joinedload(StudentVaccineDose.dose_config),
            )
            .order_by(StudentVaccine.created_at)
        )
        return list(result.unique().scalars().all())

    async def get_student_vaccine(self, sv_id: uuid.UUID) -> StudentVaccine | None:
        result = await self.db.execute(
            select(StudentVaccine)
            .where(StudentVaccine.id == sv_id)
            .options(
                joinedload(StudentVaccine.vaccine),
                selectinload(StudentVaccine.doses).joinedload(StudentVaccineDose.dose_config),
            )
        )
        return result.unique().scalar_one_or_none()

    async def get_dose_by_id(self, dose_id: uuid.UUID) -> StudentVaccineDose | None:
        result = await self.db.execute(
            select(StudentVaccineDose)
            .where(StudentVaccineDose.id == dose_id)
            .options(
                joinedload(StudentVaccineDose.student_vaccine).joinedload(StudentVaccine.vaccine),
                joinedload(StudentVaccineDose.dose_config),
            )
        )
        return result.unique().scalar_one_or_none()

    async def create_student_vaccine(self, sv: StudentVaccine) -> StudentVaccine:
        self.db.add(sv)
        await self.db.flush()
        return sv

    async def create_dose(self, dose: StudentVaccineDose) -> StudentVaccineDose:
        self.db.add(dose)
        await self.db.flush()
        return dose

    async def delete_student_vaccines(self, user_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(StudentVaccine).where(StudentVaccine.user_id == user_id)
        )
        for sv in result.scalars().all():
            await self.db.delete(sv)
        await self.db.flush()

    async def commit(self) -> None:
        await self.db.commit()
