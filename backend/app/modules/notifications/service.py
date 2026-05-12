"""Notifications module service."""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import event

from app.modules.notifications.models import Notification
from app.modules.notifications.push import PushNotificationSender
from app.modules.notifications.repository import NotificationRepository

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
        tokens = await self.repo.get_active_tokens_by_user(user_id)
        self._send_push_after_commit(
            tokens,
            title=title,
            message=message,
            category=category,
        )
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
    ) -> None:
        await self.repo.upsert_device_token(
            user_id=user_id,
            token=token,
            platform=platform,
        )
        await self.repo.commit()

    async def unregister_device_token(self, user_id: uuid.UUID, token: str) -> None:
        await self.repo.deactivate_device_token(user_id=user_id, token=token)
        await self.repo.commit()

    def _send_push_after_commit(
        self,
        tokens: list[str],
        *,
        title: str,
        message: str,
        category: str | None,
    ) -> None:
        if not tokens:
            return

        @event.listens_for(self.repo.db.sync_session, "after_commit", once=True)
        def _after_commit(_session):
            asyncio.create_task(
                self._send_push_to_tokens(
                    tokens,
                    title=title,
                    message=message,
                    category=category,
                )
            )

    async def _send_push_to_tokens(
        self,
        tokens: list[str],
        *,
        title: str,
        message: str,
        category: str | None,
    ) -> None:
        try:
            await PushNotificationSender().send_to_tokens(
                tokens,
                title=title,
                body=message,
                data={"category": category or ""},
            )
        except Exception:
            logger.exception("Failed to send push notification")
