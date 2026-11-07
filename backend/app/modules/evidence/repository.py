"""Evidence module — repository."""

import uuid

from app.modules.evidence.models import EvidenceBatch, EvidenceFile
from app.modules.users.models import User
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload


class EvidenceRepository:
    """Data access for evidence batches and files."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_batch(self, batch: EvidenceBatch) -> EvidenceBatch:
        self.db.add(batch)
        await self.db.flush()
        return batch

    async def add_file(self, file: EvidenceFile) -> EvidenceFile:
        self.db.add(file)
        await self.db.flush()
        return file

    async def get_owned_dose(
        self,
        user_id: uuid.UUID,
        dose_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> StudentVaccineDose | None:
        query = (
            select(StudentVaccineDose)
            .join(StudentVaccine, StudentVaccine.id == StudentVaccineDose.student_vaccine_id)
            .where(StudentVaccineDose.id == dose_id, StudentVaccine.user_id == user_id)
            .options(joinedload(StudentVaccineDose.dose_config))
        )
        if for_update:
            query = query.with_for_update(of=StudentVaccineDose).execution_options(
                populate_existing=True
            )
        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()

    async def get_batches_by_user(
        self,
        user_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[EvidenceBatch]:
        result = await self.db.execute(
            select(EvidenceBatch)
            .where(EvidenceBatch.user_id == user_id)
            .options(selectinload(EvidenceBatch.files))
            .order_by(EvidenceBatch.created_at.desc(), EvidenceBatch.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def count_batches_by_user(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(EvidenceBatch).where(EvidenceBatch.user_id == user_id)
        )
        return int(result.scalar_one())

    async def get_batch_by_id(
        self,
        batch_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> EvidenceBatch | None:
        query = (
            select(EvidenceBatch)
            .where(EvidenceBatch.id == batch_id)
            .options(
                selectinload(EvidenceBatch.files),
                selectinload(EvidenceBatch.dose),
                joinedload(EvidenceBatch.user).joinedload(User.profile),
            )
        )
        if for_update:
            query = query.with_for_update(of=EvidenceBatch).execution_options(
                populate_existing=True
            )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_file_by_id(self, file_id: uuid.UUID) -> EvidenceFile | None:
        result = await self.db.execute(
            select(EvidenceFile)
            .where(EvidenceFile.id == file_id)
            .options(
                joinedload(EvidenceFile.batch)
                .joinedload(EvidenceBatch.user)
                .joinedload(User.profile)
            )
        )
        return result.scalar_one_or_none()

    async def commit(self) -> None:
        await self.db.commit()

    async def rollback(self) -> None:
        await self.db.rollback()

    async def delete_batch(self, batch: EvidenceBatch) -> None:
        await self.db.delete(batch)
