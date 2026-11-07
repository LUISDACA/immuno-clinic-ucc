"""FastAPI dependencies — authentication, authorization, database."""

import uuid

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ForbiddenException,
    InactiveUserException,
    UnauthorizedException,
)
from app.core.request_context import user_id_var
from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.auth.models import AuthSession
from app.modules.auth.sessions import active
from app.modules.users.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT access token."""
    payload = decode_access_token(token)
    if payload is None:
        raise UnauthorizedException()

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException()

    try:
        uid = uuid.UUID(user_id)
        sid = uuid.UUID(payload["sid"])
    except (ValueError, KeyError, TypeError) as exc:
        raise UnauthorizedException() from exc

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("User not found")
    if not user.is_active:
        raise InactiveUserException()
    session = await db.get(AuthSession, sid)
    if not active(session, user) or payload.get("av") != user.auth_version:
        raise UnauthorizedException()

    user_id_var.set(str(user.id))
    return user


async def get_current_active_user(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is active."""
    if not current_user.is_active:
        raise InactiveUserException()
    if current_user.must_change_password and request.url.path not in {
        "/api/v1/auth/change-password",
        "/api/v1/users/me",
    }:
        raise ForbiddenException("Debes cambiar tu contraseña temporal antes de continuar")
    return current_user


def require_role(*roles: str):
    """Factory that returns a dependency to enforce role-based access."""

    async def _check_role(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role.value not in roles:
            raise ForbiddenException(f"This action requires one of these roles: {', '.join(roles)}")
        return current_user

    return _check_role
