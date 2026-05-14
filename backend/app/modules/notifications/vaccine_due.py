"""Daily vaccine due-date reminders."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timezone

from app.common.enums import Role
from app.core.config import settings
from app.core.email import send_vaccine_due_email
from app.db.session import AsyncSessionLocal
from app.modules.notifications.models import DeviceToken, Notification
from app.modules.notifications.push import PushNotificationSender
from app.modules.users.models import User
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.rules import DoseDueInfo, due_reminders_for_scheme
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

logger = logging.getLogger(__name__)


async def run_vaccine_due_reminder_loop() -> None:
    """Run vaccine reminder checks once on startup and then once per day."""
    while True:
        try:
            async with AsyncSessionLocal() as session:
                await send_due_vaccine_reminders(session)
        except Exception as exc:  # pragma: no cover - defensive background logging
            logger.exception("Vaccine reminder error: %s", exc)
        await asyncio.sleep(settings.VACCINE_REMINDER_INTERVAL_SECONDS)


async def send_due_vaccine_reminders(db: AsyncSession) -> int:
    """Send push/internal notifications for doses due between today and 7 days."""
    today = date.today()
    count = 0
    result = await db.execute(
        select(StudentVaccine)
        .join(User, StudentVaccine.user_id == User.id)
        .where(
            User.role == Role.STUDENT,
            User.is_active.is_(True),
        )
        .options(
            joinedload(StudentVaccine.user).joinedload(User.profile),
            joinedload(StudentVaccine.vaccine),
            selectinload(StudentVaccine.doses).joinedload(StudentVaccineDose.dose_config),
        )
    )

    for student_vaccine in result.unique().scalars().all():
        if student_vaccine.user is None:
            continue
        for due_info in due_reminders_for_scheme(student_vaccine, today=today):
            created = await _create_reminder_if_needed(
                db,
                user=student_vaccine.user,
                due_info=due_info,
                today=today,
            )
            if created:
                count += 1

    await db.commit()
    return count


async def _create_reminder_if_needed(
    db: AsyncSession,
    *,
    user: User,
    due_info: DoseDueInfo,
    today: date,
) -> bool:
    title = "Recordatorio de vacuna"
    message = _reminder_message(due_info)
    category = "scheme"
    if await _notification_exists_today(
        db,
        user_id=user.id,
        title=title,
        message=message,
        category=category,
        today=today,
    ):
        return False

    notification = Notification(
        user_id=user.id,
        title=title,
        message=message,
        is_read=False,
        category=category,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    await db.flush()

    tokens = await _active_tokens_for_user(db, user.id)
    await PushNotificationSender().send_to_tokens(
        tokens,
        title=title,
        body=message,
        data={"category": category},
    )
    if due_info.days_until_due in _configured_email_reminder_days():
        await send_vaccine_due_email(
            user.email,
            full_name=_user_display_name(user),
            vaccine_name=due_info.vaccine_name,
            dose_label=due_info.dose_label,
            due_date=due_info.due_date.strftime("%d/%m/%Y"),
            days_until_due=due_info.days_until_due,
        )
    return True


async def _notification_exists_today(
    db: AsyncSession,
    *,
    user_id,
    title: str,
    message: str,
    category: str,
    today: date,
) -> bool:
    start = datetime.combine(today, time.min, tzinfo=timezone.utc)
    end = datetime.combine(today, time.max, tzinfo=timezone.utc)
    result = await db.execute(
        select(Notification.id)
        .where(
            Notification.user_id == user_id,
            Notification.title == title,
            Notification.message == message,
            Notification.category == category,
            Notification.created_at >= start,
            Notification.created_at <= end,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _active_tokens_for_user(db: AsyncSession, user_id) -> list[str]:
    result = await db.execute(
        select(DeviceToken.token).where(
            DeviceToken.user_id == user_id,
            DeviceToken.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


def _reminder_message(due_info: DoseDueInfo) -> str:
    if due_info.days_until_due == 0:
        return f"Es hoy que debes ponerte {due_info.dose_label}."
    if due_info.days_until_due == 1:
        return f"Te falta 1 dia para ponerte {due_info.dose_label}."
    return f"Te faltan {due_info.days_until_due} dias para ponerte {due_info.dose_label}."


def _user_display_name(user: User) -> str:
    profile = user.__dict__.get("profile")
    if profile is None:
        return user.email
    full_name = f"{profile.first_name} {profile.last_name}".strip()
    return full_name or user.email


def _configured_email_reminder_days() -> set[int]:
    raw_days = settings.VACCINE_EMAIL_REMINDER_DAYS
    if isinstance(raw_days, str):
        return {int(item.strip()) for item in raw_days.split(",") if item.strip()}
    return {int(item) for item in raw_days}
