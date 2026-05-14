"""Evidence module — repository."""

import uuid

from app.modules.evidence.models import EvidenceBatch, EvidenceFile
from app.modules.users.models import User
from sqlalchemy import select
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
            .order_by(EvidenceBatch.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_batch_by_id(self, batch_id: uuid.UUID) -> EvidenceBatch | None:
        result = await self.db.execute(
            select(EvidenceBatch)
            .where(EvidenceBatch.id == batch_id)
            .options(selectinload(EvidenceBatch.files))
        )
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

    async def delete_batch(self, batch: EvidenceBatch) -> None:
        await self.db.delete(batch)
