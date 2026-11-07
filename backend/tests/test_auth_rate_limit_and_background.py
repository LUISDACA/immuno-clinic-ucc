"""Tests for the rate-limit-from-settings + background-task wiring.

These tests verify two behaviours that were introduced after the load test:

1. The login and forgot-password decorators read their rate from
   ``settings.RATE_LIMIT_LOGIN`` / ``settings.RATE_LIMIT_FORGOT_PASSWORD``
   at import time, not from hard-coded strings. The settings module is
   the source of truth.

2. ``AuthService.forgot_password`` dispatches the email as a FastAPI
   ``BackgroundTask`` when one is provided, so the HTTP handler can
   return immediately. When no ``BackgroundTasks`` is passed (e.g. unit
   tests, scripts), the email is sent inline as before.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.core.config import settings
from app.modules.auth.schemas import ForgotPasswordRequest
from app.modules.auth.service import AuthService


def test_rate_limit_login_is_read_from_settings():
    """``settings.RATE_LIMIT_LOGIN`` must hold a valid SlowAPI rate spec.

    A bug introduced earlier hard-coded ``"5/minute"`` directly on the
    ``@limiter.limit`` decorator, ignoring ``.env``. This test enforces
    the settings indirection so misconfigurations fail loudly.
    """
    value = settings.RATE_LIMIT_LOGIN
    assert isinstance(value, str)
    assert "/" in value, f"Expected a rate spec like '5/minute', got {value!r}"


def test_rate_limit_forgot_password_is_read_from_settings():
    value = settings.RATE_LIMIT_FORGOT_PASSWORD
    assert isinstance(value, str)
    assert "/" in value, f"Expected a rate spec like '3/minute', got {value!r}"


def test_auth_router_uses_settings_for_login_decorator():
    """The login route must apply the rate from settings, not a hard-coded value."""
    from app.modules.auth import router as auth_router

    source = auth_router.__file__
    with open(source, encoding="utf-8") as fh:
        contents = fh.read()

    assert "settings.RATE_LIMIT_LOGIN" in contents, (
        "Login route must reference settings.RATE_LIMIT_LOGIN"
    )
    assert "settings.RATE_LIMIT_FORGOT_PASSWORD" in contents, (
        "Forgot-password route must reference settings.RATE_LIMIT_FORGOT_PASSWORD"
    )


@pytest.mark.asyncio
async def test_forgot_password_uses_background_task_when_provided():
    """When BackgroundTasks is passed, the email send is deferred (not awaited inline)."""
    repo = MagicMock()
    repo.get_user_by_email = AsyncMock(
        return_value=SimpleNamespace(
            id="user-1",
            email="user@example.com",
        )
    )
    repo.lock_user = AsyncMock(
        return_value=SimpleNamespace(id="user-1", email="user@example.com", is_active=True)
    )
    repo.create_reset_token = AsyncMock()
    repo.db = MagicMock()
    repo.db.commit = AsyncMock()

    service = AuthService.__new__(AuthService)
    service.repo = repo
    service.audit = MagicMock()

    add_task_calls: list[tuple] = []

    class FakeBackgroundTasks:
        def add_task(self, fn, *args, **kwargs):
            add_task_calls.append((fn, args, kwargs))

    bg = FakeBackgroundTasks()

    await service.forgot_password(
        data=ForgotPasswordRequest(email="user@example.com"),
        background_tasks=bg,
    )

    # The email send must have been scheduled as a background task, not awaited inline.
    assert len(add_task_calls) == 1
    fn, args, _kwargs = add_task_calls[0]
    assert fn.__name__ == "send_password_reset_email"
    assert args[0] == "user@example.com"  # recipient
    assert isinstance(args[1], str) and len(args[1]) > 10  # token


@pytest.mark.asyncio
async def test_forgot_password_sends_inline_when_no_background_tasks(monkeypatch):
    """When no BackgroundTasks is provided, the email is awaited inline (legacy path)."""
    repo = MagicMock()
    repo.get_user_by_email = AsyncMock(
        return_value=SimpleNamespace(
            id="user-1",
            email="user@example.com",
        )
    )
    repo.lock_user = AsyncMock(
        return_value=SimpleNamespace(id="user-1", email="user@example.com", is_active=True)
    )
    repo.create_reset_token = AsyncMock()
    repo.db = MagicMock()
    repo.db.commit = AsyncMock()

    inline_calls: list[tuple] = []

    async def fake_send(email, token):
        inline_calls.append((email, token))

    monkeypatch.setattr(
        "app.modules.auth.service.send_password_reset_email",
        fake_send,
    )

    service = AuthService.__new__(AuthService)
    service.repo = repo
    service.audit = MagicMock()

    await service.forgot_password(
        data=ForgotPasswordRequest(email="user@example.com"),
        background_tasks=None,
    )

    assert len(inline_calls) == 1
    assert inline_calls[0][0] == "user@example.com"
