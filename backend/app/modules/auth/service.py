"""Auth module — business logic service."""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.common.enums import AuditAction
from app.core.config import settings
from app.core.email import send_password_reset_email
from app.core.exceptions import BadRequestException, InactiveUserException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.modules.audit.service import AuditService
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    AccessTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    """Return a masked email for safe logging (e.g. lu***@example.com)."""
    parts = email.split("@", 1)
    local = parts[0]
    domain = parts[1] if len(parts) > 1 else ""
    visible = local[:2] if len(local) >= 2 else local
    return f"{visible}***@{domain}"


class AuthService:
    """Authentication and password management business logic."""

    def __init__(self, repo: AuthRepository):
        self.repo = repo
        self.audit = AuditService(repo.db)

    async def login(self, email: str, password: str) -> TokenResponse:
        """Authenticate user and return token pair."""
        user = await self.repo.get_user_by_email(email)
        if user is None:
            logger.warning("Failed login — email not found: %s", _mask_email(email))
            raise UnauthorizedException("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            logger.warning("Failed login — wrong password for user_id=%s", user.id)
            raise UnauthorizedException("Invalid email or password")

        if not user.is_active:
            raise InactiveUserException()

        access = create_access_token({"sub": str(user.id), "role": user.role.value})
        refresh = create_refresh_token({"sub": str(user.id)})

        # Store refresh token hash for revocation
        refresh_hash = hashlib.sha256(refresh.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        await self.repo.create_refresh_token(user.id, refresh_hash, expires_at)
        await self.repo.db.commit()

        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            must_change_password=user.must_change_password,
        )

    async def refresh_access_token(self, refresh_token: str) -> AccessTokenResponse:
        """Issue a new access token from a valid refresh token."""
        # 1. Validate JWT signature and expiration
        payload = decode_refresh_token(refresh_token)
        if payload is None:
            raise UnauthorizedException("Invalid or expired refresh token")

        # 2. Validate against database for revocation
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        stored_token = await self.repo.get_valid_refresh_token(token_hash)
        if stored_token is None:
            raise UnauthorizedException("Refresh token revoked or not found")

        try:
            user_id = uuid.UUID(payload["sub"])
        except (TypeError, ValueError) as exc:
            raise UnauthorizedException("Invalid or expired refresh token") from exc

        user = await self.repo.get_user_by_id(user_id)
        if user is None or not user.is_active:
            raise UnauthorizedException("User not found or inactive")

        access = create_access_token({"sub": str(user.id), "role": user.role.value})
        return AccessTokenResponse(access_token=access)

    async def logout(self, refresh_token: str) -> None:
        """Revoke a refresh token on logout."""
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        stored_token = await self.repo.get_valid_refresh_token(token_hash)
        if stored_token:
            await self.repo.revoke_refresh_token(stored_token.id)
            await self.repo.db.commit()

    async def change_password(self, user: User, data: ChangePasswordRequest) -> None:
        """Change password for authenticated user."""
        if not verify_password(data.current_password, user.hashed_password):
            raise BadRequestException("La contraseña actual es incorrecta")

        new_hash = hash_password(data.new_password)
        await self.repo.update_password(user.id, new_hash)
        await self.audit.log(
            actor_id=user.id,
            action=AuditAction.PASSWORD_CHANGED,
            target_type="user",
            target_id=user.id,
            details={"student_id": str(user.id)},
        )
        await self.repo.revoke_all_user_tokens(user.id)
        await self.repo.db.commit()

    async def forgot_password(self, data: ForgotPasswordRequest) -> None:
        """Generate a password reset token and 'send' it via email."""
        requested_email = data.email.strip().lower()
        user = await self.repo.get_user_by_email(requested_email)
        if user is None:
            # Don't reveal whether user exists
            logger.info("Password reset requested for non-existent email: %s", requested_email)
            return

        logger.info("Password reset requested for user: %s", user.email)
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        await self.repo.create_reset_token(user.id, token_hash, expires_at)
        await self.repo.db.commit()

        await send_password_reset_email(user.email, raw_token)

    async def reset_password(self, data: ResetPasswordRequest) -> None:
        """Reset password using a valid reset token."""
        token_hash = hashlib.sha256(data.token.encode()).hexdigest()
        reset_token = await self.repo.get_valid_reset_token(token_hash)

        if reset_token is None:
            raise BadRequestException("Invalid or expired reset token")

        new_hash = hash_password(data.new_password)
        await self.repo.update_password(reset_token.user_id, new_hash)
        await self.repo.mark_token_used(reset_token.id)
        await self.repo.revoke_all_user_tokens(reset_token.user_id)
        await self.audit.log(
            actor_id=reset_token.user_id,
            action=AuditAction.PASSWORD_RESET,
            target_type="user",
            target_id=reset_token.user_id,
            details={"student_id": str(reset_token.user_id)},
        )
        await self.repo.db.commit()
