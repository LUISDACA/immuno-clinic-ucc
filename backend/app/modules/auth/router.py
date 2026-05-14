"""Auth module - API router (thin HTTP layer)."""

from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    AccessTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.modules.auth.service import AuthService
from app.modules.users.models import User
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(AuthRepository(db))


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request,
    data: LoginRequest,
    service: AuthService = Depends(_get_auth_service),
):
    """Authenticate and receive access + refresh tokens."""
    return await service.login(data.email, data.password)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(data: RefreshRequest, service: AuthService = Depends(_get_auth_service)):
    """Get a new access token using a valid refresh token."""
    return await service.refresh_access_token(data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(data: LogoutRequest, service: AuthService = Depends(_get_auth_service)):
    """Revoke a refresh token on logout."""
    await service.logout(data.refresh_token)
    return MessageResponse(message="Sesión cerrada correctamente")


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("5/hour")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    service: AuthService = Depends(_get_auth_service),
):
    """Change password for the currently authenticated user."""
    await service.change_password(current_user, data)
    return MessageResponse(message="Contraseña actualizada correctamente")


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_FORGOT_PASSWORD)
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    service: AuthService = Depends(_get_auth_service),
):
    """Request a password reset token (sent via email in background)."""
    await service.forgot_password(data, background_tasks)
    # Always return success to avoid revealing user existence
    return MessageResponse(
        message="Si el correo existe, recibirás instrucciones para restablecer tu contraseña"
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest, service: AuthService = Depends(_get_auth_service)
):
    """Reset password using a valid reset token."""
    await service.reset_password(data)
    return MessageResponse(message="Contraseña restablecida correctamente")
