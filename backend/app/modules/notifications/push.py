"""Firebase Cloud Messaging push delivery."""

from __future__ import annotations

import asyncio
import json
from functools import lru_cache

import firebase_admin
from app.core.config import settings
from firebase_admin import credentials, messaging


@lru_cache(maxsize=1)
def _firebase_app() -> firebase_admin.App | None:
    if not settings.FCM_ENABLED:
        return None

    if firebase_admin._apps:
        return firebase_admin.get_app()

    if settings.FIREBASE_CREDENTIALS_JSON:
        cred = credentials.Certificate(json.loads(settings.FIREBASE_CREDENTIALS_JSON))
    elif settings.FIREBASE_CREDENTIALS_PATH:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    else:
        return None

    return firebase_admin.initialize_app(cred)


class PushNotificationSender:
    """Sends push notifications through Firebase when configured."""

    async def send_to_tokens(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> None:
        if not tokens:
            return
        app = _firebase_app()
        if app is None:
            return

        payload = {key: value for key, value in (data or {}).items() if value is not None}
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=payload,
        )
        await asyncio.to_thread(messaging.send_each_for_multicast, message, app=app)
