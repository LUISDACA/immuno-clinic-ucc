import uuid
from datetime import date, timedelta

import pytest
from app.core.config import settings
from app.modules.notifications.router import _verify_cron_secret
from app.modules.notifications.vaccine_due import _create_reminder_if_needed
from app.modules.users.models import User
from app.modules.vaccination_scheme.rules import DoseDueInfo
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession


def _due_info(days_until_due: int) -> DoseDueInfo:
    return DoseDueInfo(
        dose_id=uuid.uuid4(),
        dose_number=2,
        vaccine_name="Hepatitis B",
        dose_label="Segunda dosis",
        due_date=date.today() + timedelta(days=days_until_due),
        days_until_due=days_until_due,
    )


@pytest.mark.asyncio
async def test_due_vaccine_email_is_sent_on_configured_days(
    db: AsyncSession,
    student_user: User,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = []

    async def fake_due_email(email: str, **context):
        sent_emails.append((email, context))

    monkeypatch.setattr(settings, "VACCINE_EMAIL_REMINDER_DAYS", [3, 2, 1, 0])
    monkeypatch.setattr(
        "app.modules.notifications.vaccine_due.send_vaccine_due_email",
        fake_due_email,
    )

    created = await _create_reminder_if_needed(
        db,
        user=student_user,
        due_info=_due_info(3),
        today=date.today(),
    )

    assert created is True
    assert len(sent_emails) == 1
    assert sent_emails[0][0] == "student@test.com"
    assert sent_emails[0][1]["days_until_due"] == 3
    assert sent_emails[0][1]["vaccine_name"] == "Hepatitis B"


@pytest.mark.asyncio
async def test_due_vaccine_email_is_not_sent_on_unconfigured_days(
    db: AsyncSession,
    student_user: User,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = []

    async def fake_due_email(email: str, **context):
        sent_emails.append((email, context))

    monkeypatch.setattr(settings, "VACCINE_EMAIL_REMINDER_DAYS", [3, 2, 1, 0])
    monkeypatch.setattr(
        "app.modules.notifications.vaccine_due.send_vaccine_due_email",
        fake_due_email,
    )

    created = await _create_reminder_if_needed(
        db,
        user=student_user,
        due_info=_due_info(4),
        today=date.today(),
    )

    assert created is True
    assert sent_emails == []


def test_cron_secret_accepts_matching_header(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "CRON_SECRET", "cron-value-123")

    _verify_cron_secret("cron-value-123")


def test_cron_secret_rejects_missing_or_invalid_header(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "CRON_SECRET", "cron-value-123")

    with pytest.raises(HTTPException) as exc_info:
        _verify_cron_secret("wrong-value")

    assert exc_info.value.status_code == 401
