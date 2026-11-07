"""Notifications module service."""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.modules.auth.sessions import active, invalid, lock_session, lock_user
from app.modules.notifications.models import Notification
from app.modules.notifications.push import PushNotificationSender
from app.modules.notifications.repository import NotificationRepository
from sqlalchemy import event

logger = logging.getLogger(__name__)


class NotificationService:
    """Notification business logic and push delivery coordination."""

    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def create_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str,
        category: str | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            is_read=False,
            category=category,
            created_at=datetime.now(timezone.utc),
        )
        notification = await self.repo.create(notification)
        self._send_push_after_commit(user_id)
        return notification

    async def get_user_notifications(self, user_id: uuid.UUID) -> list[Notification]:
        return await self.repo.get_by_user(user_id)

    async def mark_as_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.repo.mark_read(notification_id, user_id)
        await self.repo.commit()

    async def mark_category_as_read(self, category: str, user_id: uuid.UUID) -> None:
        await self.repo.mark_category_read(category, user_id)
        await self.repo.commit()

    async def register_device_token(
        self,
        user_id: uuid.UUID,
        token: str,
        platform: str,
        session_id: uuid.UUID,
    ) -> None:
        user = await lock_user(self.repo.db, user_id)
        session = await lock_session(self.repo.db, session_id)
        if not active(session, user):
            raise invalid()
        await self.repo.upsert_device_token(
            user_id=user_id,
            token=token,
            platform=platform,
            session_id=session_id,
        )
        await self.repo.commit()

    async def unregister_device_token(
        self, user_id: uuid.UUID, token: str, session_id: uuid.UUID
    ) -> None:
        await self.repo.deactivate_device_token(user_id=user_id, token=token, session_id=session_id)
        await self.repo.commit()

    def _send_push_after_commit(self, user_id: uuid.UUID) -> None:
        if not settings.FCM_ENABLED:
            return

        @event.listens_for(self.repo.db.sync_session, "after_commit", once=True)
        def _after_commit(_session):
            asyncio.create_task(self._send_push_to_user(user_id))

    @staticmethod
    async def _send_push_to_user(user_id: uuid.UUID) -> None:
        try:
            async with AsyncSessionLocal() as db:
                tokens = await NotificationRepository(db).get_active_tokens_by_user(user_id)
            await PushNotificationSender().send_to_tokens(tokens, title="", body="")
        except Exception:
            logger.warning("Push delivery failed")
