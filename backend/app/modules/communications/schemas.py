"""Communication module schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.common.enums import ConversationStatus


class ConversationUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None = None
    role: str


class CommunicationMessageResponse(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime
    sender: ConversationUserResponse | None = None


class CommunicationThreadResponse(BaseModel):
    id: uuid.UUID
    subject: str
    category: str | None = None
    status: ConversationStatus
    student: ConversationUserResponse
    created_by: ConversationUserResponse | None = None
    recipient: ConversationUserResponse | None = None
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime
    last_message: str | None = None
    last_message_sender: ConversationUserResponse | None = None
    messages: list[CommunicationMessageResponse] = []


class CommunicationThreadListResponse(BaseModel):
    id: uuid.UUID
    subject: str
    category: str | None = None
    status: ConversationStatus
    student: ConversationUserResponse
    created_by: ConversationUserResponse | None = None
    recipient: ConversationUserResponse | None = None
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime
    last_message: str | None = None
    last_message_sender: ConversationUserResponse | None = None


class CreateThreadRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=1, max_length=4000)
    category: str | None = Field(None, max_length=50)
    student_id: uuid.UUID | None = None
    admin_id: uuid.UUID | None = None


class CreateMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class UpdateThreadStatusRequest(BaseModel):
    status: ConversationStatus
