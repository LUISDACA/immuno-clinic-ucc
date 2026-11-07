"""Versioned rotating authentication; clinical API stays v1."""

import uuid

from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.core.rate_limit import RateLimitedRoute, limiter
from app.core.security import decode_access_token
from app.modules.auth.models import AuthSession
from app.modules.auth.router import _get_auth_service
from app.modules.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RotatedTokenResponse,
)
from app.modules.auth.service import AuthService
from app.modules.auth.sessions import invalid, lock_session, lock_user, now, revoke, utc
from app.modules.users.models import User
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["Authentication v2"], route_class=RateLimitedRoute)


@router.post("/login", response_model=RotatedTokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(data: LoginRequest, service: AuthService = Depends(_get_auth_service)):
    return await service.login(data.email, data.password, protocol=2)


@router.post("/refresh", response_model=RotatedTokenResponse)
async def refresh(data: RefreshRequest, service: AuthService = Depends(_get_auth_service)):
    return await service.refresh_access_token(data.refresh_token, protocol=2)


@router.post("/logout", status_code=204)
async def logout(data: LogoutRequest, service: AuthService = Depends(_get_auth_service)):
    await service.logout(data.refresh_token)
    return Response(status_code=204)


@router.get("/sessions")
async def sessions(
    user: User = Depends(get_current_active_user), service: AuthService = Depends(_get_auth_service)
):
    rows = (
        await service.repo.db.scalars(select(AuthSession).where(AuthSession.user_id == user.id))
    ).all()
    return [
        {
            "id": str(s.id),
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "status": "EXPIRED"
            if s.status == "ACTIVE" and utc(s.expires_at) <= now()
            else s.status,
        }
        for s in rows
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_active_user),
    service: AuthService = Depends(_get_auth_service),
):
    db = service.repo.db
    user = await lock_user(db, user.id)
    # Recheck the request's credential version after waiting for a concurrent reset.
    payload = decode_access_token(request.headers.get("authorization", "").removeprefix("Bearer "))
    if not payload or payload.get("av") != user.auth_version:
        raise invalid()
    session = await lock_session(db, session_id)
    if session is None or session.user_id != user.id:
        raise invalid()
    await revoke(db, session, "USER_REVOKE")
    await db.commit()
    return Response(status_code=204)
