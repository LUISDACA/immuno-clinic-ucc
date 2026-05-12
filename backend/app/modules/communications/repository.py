"""Communication module repository."""

import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, noload, selectinload

from app.common.enums import Role
from app.modules.communications.models import CommunicationMessage, CommunicationThread
from app.modules.users.models import Profile, User


class CommunicationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_thread(self, thread: CommunicationThread) -> CommunicationThread:
        self.db.add(thread)
        await self.db.flush()
        return thread

    async def create_message(self, message: CommunicationMessage) -> CommunicationMessage:
        self.db.add(message)
        await self.db.flush()
        return message

    def _thread_options(self, *, include_messages: bool = True):
        options = [
            joinedload(CommunicationThread.student).joinedload(User.profile),
            joinedload(CommunicationThread.created_by).joinedload(User.profile),
            joinedload(CommunicationThread.recipient).joinedload(User.profile),
        ]
        if include_messages:
            options.append(
                selectinload(CommunicationThread.messages)
                .joinedload(CommunicationMessage.sender)
                .joinedload(User.profile)
            )
        else:
            options.append(noload(CommunicationThread.messages))
        return tuple(options)

    async def get_thread(self, thread_id: uuid.UUID) -> CommunicationThread | None:
        result = await self.db.execute(
            select(CommunicationThread)
            .where(CommunicationThread.id == thread_id)
            .options(*self._thread_options(include_messages=True))
        )
        return result.unique().scalar_one_or_none()

    async def list_for_student(self, student_id: uuid.UUID) -> list[CommunicationThread]:
        result = await self.db.execute(
            select(CommunicationThread)
            .where(CommunicationThread.student_id == student_id)
            .options(*self._thread_options(include_messages=False))
            .order_by(CommunicationThread.last_message_at.desc())
        )
        return list(result.unique().scalars().all())

    async def list_all(self) -> list[CommunicationThread]:
        result = await self.db.execute(
            select(CommunicationThread)
            .options(*self._thread_options(include_messages=False))
            .order_by(CommunicationThread.last_message_at.desc())
        )
        return list(result.unique().scalars().all())

    async def list_for_admin_scope(
        self,
        program: str,
        campus: str,
        admin_id: uuid.UUID,
    ) -> list[CommunicationThread]:
        result = await self.db.execute(
            select(CommunicationThread)
            .join(CommunicationThread.student)
            .join(User.profile)
            .where(
                User.role == Role.STUDENT,
                Profile.program == program,
                Profile.campus == campus,
                or_(
                    CommunicationThread.recipient_id.is_(None),
                    CommunicationThread.recipient_id == admin_id,
                    CommunicationThread.created_by_id == admin_id,
                ),
            )
            .options(*self._thread_options(include_messages=False))
            .order_by(CommunicationThread.last_message_at.desc())
        )
        return list(result.unique().scalars().all())

    async def list_for_admin_user(self, admin_id: uuid.UUID) -> list[CommunicationThread]:
        result = await self.db.execute(
            select(CommunicationThread)
            .join(CommunicationThread.student)
            .where(
                User.role == Role.ADMIN,
                or_(
                    CommunicationThread.student_id == admin_id,
                    CommunicationThread.recipient_id == admin_id,
                    CommunicationThread.created_by_id == admin_id,
                ),
            )
            .options(*self._thread_options(include_messages=False))
            .order_by(CommunicationThread.last_message_at.desc())
        )
        return list(result.unique().scalars().all())

    async def list_app_admin_threads(self, app_admin_id: uuid.UUID) -> list[CommunicationThread]:
        result = await self.db.execute(
            select(CommunicationThread)
            .join(CommunicationThread.student)
            .where(
                User.role == Role.ADMIN,
                or_(
                    CommunicationThread.created_by_id == app_admin_id,
                    CommunicationThread.student_id == app_admin_id,
                    CommunicationThread.recipient_id == app_admin_id,
                ),
            )
            .options(*self._thread_options(include_messages=False))
            .order_by(CommunicationThread.last_message_at.desc())
        )
        return list(result.unique().scalars().all())

    async def latest_messages_by_thread(
        self,
        thread_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, CommunicationMessage]:
        if not thread_ids:
            return {}

        ranked_messages = (
            select(
                CommunicationMessage.id.label("id"),
                func.row_number()
                .over(
                    partition_by=CommunicationMessage.thread_id,
                    order_by=CommunicationMessage.created_at.desc(),
                )
                .label("rank"),
            )
            .where(CommunicationMessage.thread_id.in_(thread_ids))
            .subquery()
        )
        result = await self.db.execute(
            select(CommunicationMessage)
            .join(ranked_messages, CommunicationMessage.id == ranked_messages.c.id)
            .where(ranked_messages.c.rank == 1)
            .options(joinedload(CommunicationMessage.sender).joinedload(User.profile))
        )
        messages = result.unique().scalars().all()
        return {message.thread_id: message for message in messages}

    async def get_admins(self) -> list[User]:
        result = await self.db.execute(
            select(User)
            .options(joinedload(User.profile))
            .where(User.role.in_([Role.ADMIN, Role.APP_ADMIN]), User.is_active.is_(True))
        )
        return list(result.scalars().all())

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id).options(joinedload(User.profile))
        )
        return result.scalar_one_or_none()

    async def search_users(
        self,
        roles: list[Role],
        search: str,
        *,
        program: str | None = None,
        campus: str | None = None,
        limit: int = 8,
    ) -> list[User]:
        filters = [
            User.role.in_(roles),
            User.is_active.is_(True),
            User.email.ilike(f"%{search}%"),
        ]
        if program is not None:
            filters.append(Profile.program == program)
        if campus is not None:
            filters.append(Profile.campus == campus)

        result = await self.db.execute(
            select(User)
            .join(User.profile)
            .where(and_(*filters))
            .options(joinedload(User.profile))
            .order_by(User.email.asc())
            .limit(limit)
        )
        return list(result.unique().scalars().all())

    async def commit(self) -> None:
        await self.db.commit()
