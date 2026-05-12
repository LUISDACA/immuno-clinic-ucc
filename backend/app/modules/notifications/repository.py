"""Notifications module repository."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import DeviceToken, Notification


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
    ) -> DeviceToken:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(select(DeviceToken).where(DeviceToken.token == token))
        device_token = result.scalar_one_or_none()
        if device_token is None:
            device_token = DeviceToken(
                user_id=user_id,
                token=token,
                platform=platform,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            self.db.add(device_token)
        else:
            device_token.user_id = user_id
            device_token.platform = platform
            device_token.is_active = True
            device_token.updated_at = now
        await self.db.flush()
        return device_token

    async def deactivate_device_token(
        self,
        *,
        user_id: uuid.UUID,
        token: str,
    ) -> None:
        await self.db.execute(
            update(DeviceToken)
            .where(DeviceToken.user_id == user_id, DeviceToken.token == token)
            .values(is_active=False, updated_at=datetime.now(timezone.utc))
        )

    async def get_active_tokens_by_user(self, user_id: uuid.UUID) -> list[str]:
        result = await self.db.execute(
            select(DeviceToken.token).where(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active.is_(True),
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
