"""Notifications module repository."""

import uuid
from datetime import datetime, timezone

from app.modules.auth.models import AuthSession
from app.modules.notifications.models import DeviceToken, Notification
from app.modules.users.models import User
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession


class NotificationRepository:
    """Data access for notifications and device tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, notification: Notification) -> Notification:
        self.db.add(notification)
        await self.db.flush()
        return notification

    async def upsert_device_token(
        self,
        *,
        user_id: uuid.UUID,
        token: str,
        platform: str,
        session_id: uuid.UUID,
    ) -> DeviceToken:
        now = datetime.now(timezone.utc)
        insert = pg_insert if self.db.bind.dialect.name == "postgresql" else sqlite_insert
        stmt = insert(DeviceToken).values(
            id=uuid.uuid4(),
            user_id=user_id,
            session_id=session_id,
            token=token,
            platform=platform,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[DeviceToken.token],
            set_={
                "user_id": user_id,
                "session_id": session_id,
                "platform": platform,
                "is_active": True,
                "updated_at": now,
            },
        ).returning(DeviceToken)
        return (await self.db.execute(stmt)).scalar_one()

    async def deactivate_device_token(
        self,
        *,
        user_id: uuid.UUID,
        token: str,
        session_id: uuid.UUID,
    ) -> None:
        await self.db.execute(
            update(DeviceToken)
            .where(
                DeviceToken.user_id == user_id,
                DeviceToken.token == token,
                DeviceToken.session_id == session_id,
            )
            .values(is_active=False, updated_at=datetime.now(timezone.utc))
        )

    async def get_active_tokens_by_user(self, user_id: uuid.UUID) -> list[str]:
        result = await self.db.execute(
            select(DeviceToken.token)
            .join(AuthSession, AuthSession.id == DeviceToken.session_id)
            .join(User, User.id == DeviceToken.user_id)
            .where(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active.is_(True),
                AuthSession.status == "ACTIVE",
                AuthSession.expires_at > datetime.now(timezone.utc),
                AuthSession.user_id == user_id,
                AuthSession.auth_version == User.auth_version,
                User.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_by_user(self, user_id: uuid.UUID) -> list[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
        return list(result.scalars().all())

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )

    async def mark_category_read(self, category: str, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.category == category,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )

    async def commit(self) -> None:
        await self.db.commit()
