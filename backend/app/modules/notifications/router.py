"""Notifications module router."""

import hmac
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.db.session import get_db
from app.modules.notifications.models import Notification
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.schemas import (
    CronReminderResponse,
    DeviceTokenRequest,
    MessageResponse,
    NotificationResponse,
)
from app.modules.notifications.service import NotificationService
from app.modules.notifications.vaccine_due import send_due_vaccine_reminders
from app.modules.users.models import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _get_notification_service(db: AsyncSession = Depends(get_db)) -> NotificationService:
    return NotificationService(NotificationRepository(db))


def _verify_cron_secret(header_secret: str | None) -> None:
    configured_secret = settings.CRON_SECRET
    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cron endpoint is not configured",
        )
    if not header_secret or not hmac.compare_digest(header_secret, configured_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret",
        )


def _notification_action_path(notification: Notification, user: User) -> str | None:
    role = user.role.value
    if role in {"admin", "app_admin"}:
        if notification.category == "communication":
            return "/admin/communications"
        if notification.category == "system":
            return "/admin"
        return None

    if notification.category == "communication":
        return "/student/communications"
    if notification.category in {"scheme", "review"}:
        return "/student/scheme"
    if notification.category == "evidence":
        return "/student/evidence"
    if notification.category == "system":
        return "/student/profile"
    return None


def _notification_response(
    notification: Notification,
    user: User,
) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        is_read=notification.is_read,
        category=notification.category,
        action_path=_notification_action_path(notification, user),
        created_at=notification.created_at,
    )


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_active_user),
    service: NotificationService = Depends(_get_notification_service),
):
    """Get all notifications for the current user."""
    notifications = await service.get_user_notifications(current_user.id)
    return [_notification_response(notification, current_user) for notification in notifications]


@router.put("/{notification_id}/read", response_model=MessageResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: NotificationService = Depends(_get_notification_service),
):
    """Mark a notification as read."""
    await service.mark_as_read(notification_id, current_user.id)
    return {"message": "Notificacion marcada como leida"}


@router.put("/category/{category}/read", response_model=MessageResponse)
async def mark_notification_category_read(
    category: str,
    current_user: User = Depends(get_current_active_user),
    service: NotificationService = Depends(_get_notification_service),
):
    """Mark all notifications in a category as read for the current user."""
    await service.mark_category_as_read(category, current_user.id)
    return {"message": "Categoria marcada como leida"}


@router.post("/device-token", response_model=MessageResponse)
async def register_device_token(
    payload: DeviceTokenRequest,
    current_user: User = Depends(get_current_active_user),
    service: NotificationService = Depends(_get_notification_service),
):
    """Register or refresh the current user's FCM device token."""
    await service.register_device_token(
        current_user.id,
        payload.token,
        payload.platform,
    )
    return {"message": "Dispositivo registrado"}


@router.delete("/device-token", response_model=MessageResponse)
async def unregister_device_token(
    payload: DeviceTokenRequest,
    current_user: User = Depends(get_current_active_user),
    service: NotificationService = Depends(_get_notification_service),
):
    """Deactivate the current user's FCM device token."""
    await service.unregister_device_token(current_user.id, payload.token)
    return {"message": "Dispositivo desregistrado"}


@router.post("/cron/vaccine-reminders", response_model=CronReminderResponse)
async def run_vaccine_reminder_cron(
    db: AsyncSession = Depends(get_db),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """Run vaccine reminders from an external scheduler."""
    _verify_cron_secret(x_cron_secret)
    created = await send_due_vaccine_reminders(db)
    return {
        "message": "Recordatorios de vacunas procesados",
        "created_notifications": created,
    }
