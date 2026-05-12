"""Communication module service."""

import uuid
from datetime import datetime, timezone

from app.common.access import (
    ensure_student_in_admin_scope,
    is_admin_role,
    is_app_admin,
    require_admin_scope,
    student_in_admin_scope,
)
from app.common.enums import ConversationStatus, Role
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.modules.communications.models import CommunicationMessage, CommunicationThread
from app.modules.communications.repository import CommunicationRepository
from app.modules.communications.schemas import CreateMessageRequest, CreateThreadRequest
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User


class CommunicationService:
    def __init__(self, repo: CommunicationRepository):
        self.repo = repo
        self.notifications = NotificationService(NotificationRepository(repo.db))

    async def list_threads(self, current_user: User) -> list[CommunicationThread]:
        if is_app_admin(current_user):
            return await self.repo.list_app_admin_threads(current_user.id)
        if current_user.role == Role.ADMIN:
            program, campus = require_admin_scope(current_user)
            student_threads = await self.repo.list_for_admin_scope(program, campus, current_user.id)
            admin_threads = await self.repo.list_for_admin_user(current_user.id)
            threads = {thread.id: thread for thread in [*student_threads, *admin_threads]}
            return sorted(
                threads.values(),
                key=lambda thread: thread.last_message_at,
                reverse=True,
            )
        return await self.repo.list_for_student(current_user.id)

    async def get_thread(self, current_user: User, thread_id: uuid.UUID) -> CommunicationThread:
        thread = await self.repo.get_thread(thread_id)
        if thread is None:
            raise NotFoundException("Conversation", str(thread_id))
        self._ensure_access(current_user, thread)
        return thread

    async def create_thread(
        self,
        current_user: User,
        data: CreateThreadRequest,
    ) -> CommunicationThread:
        if is_app_admin(current_user):
            if data.admin_id is None:
                raise BadRequestException("Debe indicar el administrador")
            admin = await self.repo.get_user(data.admin_id)
            if admin is None or admin.role != Role.ADMIN:
                raise NotFoundException("Admin", str(data.admin_id))
            student_id = admin.id
            recipient_id = admin.id
        elif is_admin_role(current_user.role):
            if data.admin_id is not None:
                app_admin = await self.repo.get_user(data.admin_id)
                if app_admin is None or app_admin.role != Role.APP_ADMIN:
                    raise NotFoundException("Admin", str(data.admin_id))
                student_id = current_user.id
                recipient_id = app_admin.id
            else:
                if data.student_id is None:
                    raise BadRequestException("Debe indicar el estudiante")
                student = await self.repo.get_user(data.student_id)
                if student is None or student.role != Role.STUDENT:
                    raise NotFoundException("Student", str(data.student_id))
                ensure_student_in_admin_scope(current_user, student)
                student_id = student.id
                recipient_id = student.id
        else:
            recipient_id = None
            if data.admin_id is not None:
                admin = await self.repo.get_user(data.admin_id)
                if admin is None or admin.role != Role.ADMIN:
                    raise NotFoundException("Admin", str(data.admin_id))
                if not student_in_admin_scope(admin, current_user):
                    raise ForbiddenException("No puedes escribir a este administrador")
                recipient_id = admin.id
            student_id = current_user.id

        now = datetime.now(timezone.utc)
        thread = CommunicationThread(
            student_id=student_id,
            created_by_id=current_user.id,
            recipient_id=recipient_id,
            subject=data.subject.strip(),
            category=data.category,
            status=ConversationStatus.OPEN,
            last_message_at=now,
        )
        thread = await self.repo.create_thread(thread)
        await self.repo.create_message(
            CommunicationMessage(
                thread_id=thread.id,
                sender_id=current_user.id,
                body=data.message.strip(),
                created_at=now,
            )
        )
        await self._notify_new_thread(current_user, thread)
        await self.repo.commit()
        return await self.repo.get_thread(thread.id)

    async def add_message(
        self,
        current_user: User,
        thread_id: uuid.UUID,
        data: CreateMessageRequest,
    ) -> CommunicationThread:
        thread = await self.repo.get_thread(thread_id)
        if thread is None:
            raise NotFoundException("Conversation", str(thread_id))
        self._ensure_access(current_user, thread)

        if thread.status == ConversationStatus.CLOSED:
            thread.status = ConversationStatus.OPEN

        now = datetime.now(timezone.utc)
        thread.last_message_at = now
        await self.repo.create_message(
            CommunicationMessage(
                thread_id=thread.id,
                sender_id=current_user.id,
                body=data.message.strip(),
                created_at=now,
            )
        )
        await self._notify_reply(current_user, thread)
        await self.repo.commit()
        return await self.repo.get_thread(thread.id)

    async def update_status(
        self,
        current_user: User,
        thread_id: uuid.UUID,
        status: ConversationStatus,
    ) -> CommunicationThread:
        thread = await self.repo.get_thread(thread_id)
        if thread is None:
            raise NotFoundException("Conversation", str(thread_id))
        self._ensure_access(current_user, thread)
        thread.status = status
        await self.repo.commit()
        return await self.repo.get_thread(thread.id)

    def _ensure_access(self, current_user: User, thread: CommunicationThread) -> None:
        if is_app_admin(current_user):
            if thread.created_by_id == current_user.id:
                return
            if thread.recipient_id == current_user.id:
                return
            if thread.student and thread.student.role == Role.ADMIN:
                return
            raise ForbiddenException("No tienes permiso para ver esta conversacion")
        if current_user.role == Role.ADMIN and thread.student_id == current_user.id:
            return
        if current_user.role == Role.ADMIN and thread.recipient_id == current_user.id:
            return
        if current_user.role == Role.ADMIN and thread.created_by_id == current_user.id:
            return
        if current_user.role == Role.ADMIN:
            if thread.student is None:
                raise ForbiddenException("No tienes permiso para ver esta conversacion")
            if thread.recipient_id is not None:
                raise ForbiddenException("No tienes permiso para ver esta conversacion")
            ensure_student_in_admin_scope(current_user, thread.student)
            return
        if thread.student_id != current_user.id:
            raise ForbiddenException("No tienes permiso para ver esta conversación")

    async def search_recipients(self, current_user: User, target: str, search: str) -> list[User]:
        clean_search = search.strip()
        if len(clean_search) < 2:
            return []

        if target == "admins":
            if is_app_admin(current_user):
                return await self.repo.search_users([Role.ADMIN], clean_search)
            if current_user.role == Role.ADMIN:
                return await self.repo.search_users([Role.APP_ADMIN], clean_search)

            profile = current_user.profile
            if profile is None or not profile.program or not profile.campus:
                return []
            return await self.repo.search_users(
                [Role.ADMIN],
                clean_search,
                program=profile.program,
                campus=profile.campus,
            )

        if target == "students":
            if is_app_admin(current_user):
                return await self.repo.search_users([Role.STUDENT], clean_search)
            if current_user.role == Role.ADMIN:
                program, campus = require_admin_scope(current_user)
                return await self.repo.search_users(
                    [Role.STUDENT],
                    clean_search,
                    program=program,
                    campus=campus,
                )
            raise ForbiddenException("No puedes buscar estudiantes")

        raise BadRequestException("Tipo de destinatario no válido")

    async def _notify_new_thread(self, current_user: User, thread: CommunicationThread) -> None:
        if thread.recipient_id is not None and thread.recipient_id != current_user.id:
            await self.notifications.create_notification(
                thread.recipient_id,
                "Nuevo mensaje",
                f"{current_user.email} abrio una conversacion: {thread.subject}",
                category="communication",
            )
            return

        if is_admin_role(current_user.role):
            await self.notifications.create_notification(
                thread.student_id,
                "Nuevo mensaje del administrador",
                f"Se abrió una conversación: {thread.subject}",
                category="communication",
            )
            return

        student = await self.repo.get_user(thread.student_id)
        for admin in await self.repo.get_admins():
            if (
                student is not None
                and admin.role == Role.ADMIN
                and not student_in_admin_scope(admin, student)
            ):
                continue
            await self.notifications.create_notification(
                admin.id,
                "Nueva consulta de estudiante",
                f"{current_user.email} abrió una conversación: {thread.subject}",
                category="communication",
            )

    async def _notify_reply(self, current_user: User, thread: CommunicationThread) -> None:
        if thread.recipient_id is not None and thread.recipient_id != current_user.id:
            await self.notifications.create_notification(
                thread.recipient_id,
                "Nueva respuesta",
                f"{current_user.email} respondio en: {thread.subject}",
                category="communication",
            )
            return

        if thread.created_by_id is not None and thread.created_by_id != current_user.id:
            await self.notifications.create_notification(
                thread.created_by_id,
                "Nueva respuesta",
                f"{current_user.email} respondio en: {thread.subject}",
                category="communication",
            )
            return

        if (
            current_user.role == Role.ADMIN
            and thread.student_id == current_user.id
            and thread.created_by_id is not None
        ):
            await self.notifications.create_notification(
                thread.created_by_id,
                "Respuesta de administrador",
                f"{current_user.email} respondio en: {thread.subject}",
                category="communication",
            )
            return

        if is_admin_role(current_user.role):
            await self.notifications.create_notification(
                thread.student_id,
                "Respuesta del administrador",
                f"Hay una respuesta en: {thread.subject}",
                category="communication",
            )
            return

        student = await self.repo.get_user(thread.student_id)
        for admin in await self.repo.get_admins():
            if (
                student is not None
                and admin.role == Role.ADMIN
                and not student_in_admin_scope(admin, student)
            ):
                continue
            await self.notifications.create_notification(
                admin.id,
                "Respuesta de estudiante",
                f"{current_user.email} respondió en: {thread.subject}",
                category="communication",
            )
