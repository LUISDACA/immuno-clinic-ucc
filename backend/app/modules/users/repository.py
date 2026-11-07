"""Users module — repository."""

import uuid

from app.common.enums import Role
from app.modules.users.models import Profile, User
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload


class UserRepository:
    """Data access for User and Profile entities."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(
            select(User).options(joinedload(User.profile)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        normalized_email = email.strip().lower()
        result = await self.db.execute(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        return result.scalar_one_or_none()

    async def get_profile_by_document_number(
        self,
        document_number: str,
    ) -> Profile | None:
        result = await self.db.execute(
            select(Profile).where(Profile.document_number == document_number)
        )
        return result.scalar_one_or_none()

    async def get_profile_by_student_id(self, student_id: str) -> Profile | None:
        result = await self.db.execute(select(Profile).where(Profile.student_id == student_id))
        return result.scalar_one_or_none()

    async def create_user(self, user: User) -> User:
        self.db.add(user)
        await self.db.flush()
        return user

    async def create_profile(self, profile: Profile) -> Profile:
        self.db.add(profile)
        await self.db.flush()
        return profile

    async def update_profile(self, profile: Profile, data: dict) -> Profile:
        for key, value in data.items():
            setattr(profile, key, value)
        await self.db.flush()
        return profile

    async def list_admins(self) -> list[User]:
        result = await self.db.execute(
            select(User)
            .options(joinedload(User.profile))
            .where(User.role == Role.ADMIN)
            .order_by(User.created_at.desc())
        )
        return list(result.unique().scalars().all())

    async def commit(self) -> None:
        await self.db.commit()
