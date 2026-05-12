"""Users module — API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import ProfileUpdateRequest, UserResponse
from app.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


def _get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(UserRepository(db))


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    service: UserService = Depends(_get_user_service),
):
    """Get the current authenticated user with profile."""
    return await service.get_user_with_profile(current_user.id)


@router.put("/me/profile", response_model=UserResponse)
async def update_my_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    service: UserService = Depends(_get_user_service),
):
    """Update the current user's profile."""
    return await service.update_own_profile(current_user, data)
