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
from app.modules.auth.models import AuthSession, RefreshToken
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    AccessTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RotatedTokenResponse,
)
from app.modules.auth.sessions import (
    digest,
    invalid,
    lock_user,
    now,
    resolve,
    revoke,
    utc,
)
from app.modules.users.models import User
from fastapi import BackgroundTasks, HTTPException

logger = logging.getLogger(__name__)


class AuthService:
    """Authentication and password management business logic."""

    def __init__(self, repo: AuthRepository):
        self.repo = repo
        self.audit = AuditService(repo.db)

    async def login(self, email: str, password: str, *, protocol: int = 1):
        if protocol == 1 and not settings.AUTH_V1_ENABLED:
            raise HTTPException(410, "AUTH_VERSION_RETIRED")
        user = await self.repo.get_user_by_email(email)
        if user is not None:
            user = await lock_user(self.repo.db, user.id)
        if user is None or not verify_password(password, user.hashed_password):
            logger.warning("Login rejected")
            raise UnauthorizedException("Invalid email or password")
        if not user.is_active:
            raise InactiveUserException()
        session = AuthSession(
            id=uuid.uuid4(),
            user_id=user.id,
            protocol_version=protocol,
            auth_version=user.auth_version,
            created_at=now(),
            expires_at=now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.repo.db.add(session)
        await self.repo.db.flush()
        result, _ = await self._issue(user, session, 0)
        await self.repo.db.commit()
        return result

    async def _issue(self, user, session, generation):
        claims = {"sub": str(user.id), "sid": str(session.id), "av": user.auth_version}
        access = create_access_token(
            {**claims, "role": user.role.value}, expires_at=utc(session.expires_at)
        )
        refresh = create_refresh_token(claims, expires_at=utc(session.expires_at))
        token = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            session_id=session.id,
            generation=generation,
            token_hash=digest(refresh),
            expires_at=session.expires_at,
            revoked=False,
        )
        self.repo.db.add(token)
        await self.repo.db.flush()
        remaining = max(0, int((utc(session.expires_at) - now()).total_seconds()))
        return RotatedTokenResponse(
            access_token=access,
            refresh_token=refresh,
            session_id=str(session.id),
            expires_in=min(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, remaining),
            refresh_expires_in=remaining,
            must_change_password=user.must_change_password,
        ), token

    async def refresh_access_token(self, refresh_token: str, *, protocol: int = 1):
        if protocol == 1 and not settings.AUTH_V1_ENABLED:
            raise HTTPException(410, "AUTH_VERSION_RETIRED")
        payload = decode_refresh_token(refresh_token)
        if payload is None:
            raise invalid()
        user, session, token = await resolve(
            self.repo.db, refresh_token, payload, protocol=protocol
        )
        if token.consumed_at is not None or token.revoked:
            await revoke(self.repo.db, session, "REFRESH_REPLAY", compromised=True)
            await self.repo.db.commit()  # Must survive the 401 response.
            raise invalid()
        if protocol == 1:
            access = create_access_token(
                {
                    "sub": str(user.id),
                    "sid": str(session.id),
                    "av": user.auth_version,
                    "role": user.role.value,
                },
                expires_at=utc(session.expires_at),
            )
            await self.repo.db.commit()
            return AccessTokenResponse(access_token=access)
        token.consumed_at = now()
        await self.repo.db.flush()  # Release the partial unique index before inserting successor.
        response, successor = await self._issue(user, session, token.generation + 1)
        token.replaced_by_id = successor.id
        await self.repo.db.commit()
        return response

    async def logout(self, refresh_token: str) -> None:
        payload = decode_refresh_token(refresh_token)
        if payload is None:
            return
        try:
            _, session, _ = await resolve(self.repo.db, refresh_token, payload)
        except HTTPException:
            return
        # Any known member can close its family, including one just consumed.
        await revoke(self.repo.db, session, "LOGOUT")
        await self.repo.db.commit()

    async def change_password(self, user: User, data: ChangePasswordRequest) -> None:
        """Change password for authenticated user."""
        user = await self.repo.lock_user(user.id)
        if user is None or not user.is_active:
            raise invalid()
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
        await self.repo.invalidate_credentials(user.id, "PASSWORD_CHANGED")
        await self.repo.db.commit()

    async def forgot_password(
        self,
        data: ForgotPasswordRequest,
        background_tasks: BackgroundTasks | None = None,
    ) -> None:
        """Generate a password reset token and 'send' it via email.

        If ``background_tasks`` is provided, the SMTP/SendGrid call is dispatched
        as a FastAPI background task so the HTTP response returns immediately.
        Otherwise the email is sent inline (legacy behavior, useful in tests).
        """
        requested_email = data.email.strip().lower()
        user = await self.repo.get_user_by_email(requested_email)
        if user is None:
            # Don't reveal whether user exists
            logger.info("Password reset request processed")
            return

        user = await self.repo.lock_user(user.id)
        if user is None or not user.is_active:
            return
        logger.info("Password reset request processed")
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        await self.repo.create_reset_token(user.id, token_hash, expires_at)
        await self.repo.db.commit()

        if background_tasks is not None:
            background_tasks.add_task(send_password_reset_email, user.email, raw_token)
        else:
            await send_password_reset_email(user.email, raw_token)

    async def reset_password(self, data: ResetPasswordRequest) -> None:
        """Reset password using a valid reset token."""
        token_hash = hashlib.sha256(data.token.encode()).hexdigest()
        owner_id = await self.repo.reset_token_user(token_hash)
        if owner_id is None:
            raise BadRequestException("Invalid or expired reset token")
        user = await self.repo.lock_user(owner_id)
        if user is None or not user.is_active:
            raise BadRequestException("Invalid or expired reset token")
        user_id = await self.repo.consume_reset_token(token_hash)

        if user_id is None:
            raise BadRequestException("Invalid or expired reset token")

        new_hash = hash_password(data.new_password)
        await self.repo.update_password(user_id, new_hash)
        await self.repo.invalidate_credentials(user_id, "PASSWORD_RESET")
        await self.audit.log(
            actor_id=user_id,
            action=AuditAction.PASSWORD_RESET,
            target_type="user",
            target_id=user_id,
            details={"student_id": str(user_id)},
        )
        await self.repo.db.commit()
