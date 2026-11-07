"""Communication module API router."""

import uuid

from app.core.dependencies import get_current_active_user
from app.db.session import get_db
from app.modules.communications.models import CommunicationMessage, CommunicationThread
from app.modules.communications.repository import CommunicationRepository
from app.modules.communications.schemas import (
    CommunicationMessageResponse,
    CommunicationThreadListResponse,
    CommunicationThreadResponse,
    ConversationUserResponse,
    CreateMessageRequest,
    CreateThreadRequest,
    RecipientSearchRequest,
    UpdateThreadStatusRequest,
)
from app.modules.communications.service import CommunicationService
from app.modules.users.models import User
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/communications", tags=["Communications"])


def _get_service(db: AsyncSession = Depends(get_db)) -> CommunicationService:
    return CommunicationService(CommunicationRepository(db))


def _user_response(user: User | None) -> ConversationUserResponse | None:
    if user is None:
        return None
    name = None
    if user.profile:
        name = f"{user.profile.first_name} {user.profile.last_name}".strip()
    return ConversationUserResponse(
        id=user.id,
        email=user.email,
        name=name,
        role=user.role.value,
    )


def _message_response(message: CommunicationMessage) -> CommunicationMessageResponse:
    return CommunicationMessageResponse(
        id=message.id,
        body=message.body,
        created_at=message.created_at,
        sender=_user_response(message.sender),
    )


def _thread_response(thread: CommunicationThread) -> CommunicationThreadResponse:
    messages = [_message_response(message) for message in thread.messages]
    return CommunicationThreadResponse(
        id=thread.id,
        subject=thread.subject,
        category=thread.category,
        status=thread.status,
        student=_user_response(thread.student),
        created_by=_user_response(thread.created_by),
        recipient=_user_response(thread.recipient),
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        last_message_at=thread.last_message_at,
        last_message=messages[-1].body if messages else None,
        last_message_sender=messages[-1].sender if messages else None,
        messages=messages,
    )


def _thread_list_response(
    thread: CommunicationThread,
    last_message: CommunicationMessage | None,
) -> CommunicationThreadListResponse:
    return CommunicationThreadListResponse(
        id=thread.id,
        subject=thread.subject,
        category=thread.category,
        status=thread.status,
        student=_user_response(thread.student),
        created_by=_user_response(thread.created_by),
        recipient=_user_response(thread.recipient),
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        last_message_at=thread.last_message_at,
        last_message=last_message.body if last_message else None,
        last_message_sender=_user_response(last_message.sender) if last_message else None,
    )


@router.get("/threads", response_model=list[CommunicationThreadListResponse])
async def list_threads(
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    threads = await service.list_threads(current_user)
    latest_messages = await service.repo.latest_messages_by_thread(
        [thread.id for thread in threads]
    )
    return [_thread_list_response(thread, latest_messages.get(thread.id)) for thread in threads]


@router.get("/recipients", response_model=list[ConversationUserResponse])
async def search_recipients(
    target: str = Query(..., pattern="^(admins|students)$"),
    search: str = Query(..., min_length=2, max_length=100),
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    users = await service.search_recipients(current_user, target, search)
    return [_user_response(user) for user in users]


@router.post("/recipients/search", response_model=list[ConversationUserResponse])
async def search_recipients_body(
    data: RecipientSearchRequest,
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    """Body-based search avoids putting names or emails in request URLs."""
    users = await service.search_recipients(current_user, data.target, data.search)
    return [_user_response(user) for user in users]


@router.post("/threads", response_model=CommunicationThreadResponse)
async def create_thread(
    data: CreateThreadRequest,
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    thread = await service.create_thread(current_user, data)
    return _thread_response(thread)


@router.get("/threads/{thread_id}", response_model=CommunicationThreadResponse)
async def get_thread(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    thread = await service.get_thread(current_user, thread_id)
    return _thread_response(thread)


@router.post("/threads/{thread_id}/messages", response_model=CommunicationThreadResponse)
async def add_message(
    thread_id: uuid.UUID,
    data: CreateMessageRequest,
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    thread = await service.add_message(current_user, thread_id, data)
    return _thread_response(thread)


@router.put("/threads/{thread_id}/status", response_model=CommunicationThreadResponse)
async def update_status(
    thread_id: uuid.UUID,
    data: UpdateThreadStatusRequest,
    current_user: User = Depends(get_current_active_user),
    service: CommunicationService = Depends(_get_service),
):
    thread = await service.update_status(current_user, thread_id, data.status)
    return _thread_response(thread)
