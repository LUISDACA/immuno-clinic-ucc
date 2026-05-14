"""Workflows for app-admin managed administrator accounts."""

import uuid

from app.common.access import is_app_admin
from app.common.enums import AuditAction, Gender, Role
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.security import hash_password
from app.modules.admin.schemas import CreateAdminRequest
from app.modules.audit.service import AuditService
from app.modules.users.models import Profile, User
from app.modules.users.repository import UserRepository
from sqlalchemy.ext.asyncio import AsyncSession


def _fallback_first_name(email: str) -> str:
    local_part = email.split("@", maxsplit=1)[0].strip()
    return local_part[:100] or "Administrador"


class AdminAccountService:
    """Coordinates app-admin operations over normal admin accounts."""

    def __init__(
        self,
        db: AsyncSession,
        user_repo: UserRepository,
        audit: AuditService,
    ):
        self.db = db
        self.user_repo = user_repo
        self.audit = audit

    async def create_admin(self, app_admin: User, data: CreateAdminRequest) -> User:
        self._ensure_app_admin(app_admin, "crear administradores")

        existing = await self.user_repo.get_by_email(data.email)
        if existing:
            raise ConflictException(f"Ya existe un usuario con el correo {data.email}")

        admin = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            role=Role.ADMIN,
            is_active=True,
        )
        admin = await self.user_repo.create_user(admin)
        await self.user_repo.create_profile(
            Profile(
                user_id=admin.id,
                first_name=data.first_name or _fallback_first_name(str(data.email)),
                last_name=data.last_name or "",
                job_title=data.job_title,
                sex=Gender.MALE,
                program=data.program,
                campus=data.campus,
            )
        )
        await self.audit.log(
            actor_id=app_admin.id,
            action=AuditAction.ADMIN_CREATED,
            target_type="user",
            target_id=admin.id,
            details={
                "email": data.email,
                "job_title": data.job_title,
                "program": data.program,
                "campus": data.campus,
            },
        )

        await self.db.commit()
        return await self.user_repo.get_by_id(admin.id)

    async def list_admins(self, app_admin: User) -> list[User]:
        self._ensure_app_admin(app_admin, "ver administradores")
        return await self.user_repo.list_admins()

    async def delete_admin(self, app_admin: User, admin_id: uuid.UUID) -> None:
        self._ensure_app_admin(app_admin, "eliminar administradores")
        if app_admin.id == admin_id:
            raise BadRequestException("No puedes eliminar tu propia cuenta")

        admin = await self.user_repo.get_by_id(admin_id)
        if admin is None or admin.role != Role.ADMIN:
            raise NotFoundException("Admin", str(admin_id))

        await self.audit.log(
            actor_id=app_admin.id,
            action=AuditAction.ADMIN_DELETED,
            target_type="user",
            target_id=admin.id,
            details={"email": admin.email},
        )
        await self.db.delete(admin)
        await self.db.commit()

    def _ensure_app_admin(self, user: User, action: str) -> None:
        if not is_app_admin(user):
            raise ForbiddenException(f"Solo el administrador de aplicacion puede {action}")
