"""Shared session primitives; all writers lock user -> session -> token."""

import hashlib
import uuid
from datetime import datetime, timezone

from app.core.exceptions import UnauthorizedException
from app.modules.auth.models import AuthSession, RefreshToken
from app.modules.notifications.models import DeviceToken
from app.modules.users.models import User
from sqlalchemy import select, update


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def now():
    return datetime.now(timezone.utc)


def digest(token: str):
    return hashlib.sha256(token.encode()).hexdigest()


def invalid():
    return UnauthorizedException(detail="La sesión no es válida. Inicia sesión nuevamente.")


async def lock_user(db, user_id):
    return await db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update(of=User)
        .execution_options(populate_existing=True)
    )


async def lock_session(db, session_id):
    return await db.scalar(
        select(AuthSession)
        .where(AuthSession.id == session_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def active(session, user):
    return (
        session is not None
        and user is not None
        and user.is_active
        and session.user_id == user.id
        and session.status == "ACTIVE"
        and utc(session.expires_at) > now()
        and session.auth_version == user.auth_version
    )


async def revoke(db, session, reason, *, compromised=False):
    if session.status == "ACTIVE":
        session.status = "COMPROMISED" if compromised else "REVOKED"
        session.revoked_at = now()
        session.revocation_reason = reason
    await db.execute(
        update(DeviceToken).where(DeviceToken.session_id == session.id).values(is_active=False)
    )
    await db.execute(
        update(RefreshToken).where(RefreshToken.session_id == session.id).values(revoked=True)
    )


async def resolve(db, raw, payload, *, protocol=None):
    try:
        uid, sid = uuid.UUID(payload["sub"]), uuid.UUID(payload["sid"])
    except (KeyError, TypeError, ValueError):
        raise invalid() from None
    user = await lock_user(db, uid)
    session = await lock_session(db, sid)
    if not active(session, user) or payload.get("av") != user.auth_version:
        raise invalid()
    if protocol is not None and session.protocol_version != protocol:
        raise invalid()
    token = await db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == digest(raw), RefreshToken.session_id == sid)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if token is None or token.user_id != uid or utc(token.expires_at) <= now():
        raise invalid()
    return user, session, token
