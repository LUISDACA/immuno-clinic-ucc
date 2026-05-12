"""Users module — service (business logic)."""

import uuid

from app.common.enums import AuditAction, Role
from app.core.exceptions import NotFoundException
from app.modules.audit.service import AuditService, build_change_details
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import ProfileUpdateRequest


class UserService:
    """User and profile management business logic."""

    def __init__(self, repo: UserRepository):
        self.repo = repo
        self.audit = AuditService(repo.db)

    async def get_user_with_profile(self, user_id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if user is None:
            raise NotFoundException("User", str(user_id))
        return user

    async def update_own_profile(self, user: User, data: ProfileUpdateRequest) -> User:
        if user.profile is None:
            raise NotFoundException("Profile")

        update_data = data.model_dump(exclude_unset=True)
        if user.role == Role.STUDENT:
            update_data.pop("job_title", None)
            update_data.pop("birth_date", None)
            update_data.pop("program", None)
            update_data.pop("campus", None)
            update_data.pop("semester", None)
        if update_data:
            before = {key: getattr(user.profile, key) for key in update_data}
            await self.repo.update_profile(user.profile, update_data)
            changes = build_change_details(before, update_data)
            if changes:
                await self.audit.log(
                    actor_id=user.id,
                    action=AuditAction.PROFILE_UPDATED,
                    target_type="user",
                    target_id=user.id,
                    details={
                        "student_id": str(user.id) if user.role == Role.STUDENT else None,
                        "source": user.role.value,
                        "changes": changes,
                    },
                )
            await self.repo.commit()

        return await self.repo.get_by_id(user.id)
