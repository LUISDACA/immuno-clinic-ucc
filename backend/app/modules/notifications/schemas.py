"""Notifications module schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    is_read: bool
    category: str | None = None
    action_path: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceTokenRequest(BaseModel):
    token: str
    platform: str = "android"


class MessageResponse(BaseModel):
    message: str


class CronReminderResponse(BaseModel):
    message: str
    created_notifications: int
