"""Async PostgreSQL fixed-window limits shared by every API worker."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import inspect
import ipaddress
import math
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from functools import wraps

from fastapi import HTTPException, Request
from fastapi.routing import APIRoute
from sqlalchemy import case, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.modules.auth.models import RateLimitBucket

_UNITS = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}


def _peer(request: Request) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(request.client.host) if request.client else None
    except ValueError:
        return None


def _trusted_networks():
    return tuple(
        ipaddress.ip_network(value, strict=False) for value in settings.TRUSTED_PROXY_CIDRS
    )


def _is_trusted(address, networks):
    return address is not None and any(
        address.version == net.version and address in net for net in networks
    )


def _real_ip(request: Request) -> str:
    """Read forwarded chain only when the TCP peer is explicitly trusted."""
    peer = _peer(request)
    networks = _trusted_networks()
    if not _is_trusted(peer, networks):
        return str(peer) if peer else "unknown"
    chain = request.headers.get("x-forwarded-for", "").split(",")
    for item in reversed(chain):
        try:
            candidate = ipaddress.ip_address(item.strip())
        except ValueError:
            return str(peer)
        if not _is_trusted(candidate, networks):
            return str(candidate)
    return str(peer)


def _window(spec: str):
    match = re.fullmatch(r"\s*(\d+)\s*/\s*(second|minute|hour|day)s?\s*", spec)
    if not match or int(match.group(1)) < 1:
        raise ValueError("Invalid rate policy")
    limit, unit = int(match.group(1)), match.group(2)
    return limit, timedelta(seconds=_UNITS[unit])


def _key(request: Request, policy: str) -> str:
    # HMAC prevents email/IP/session identifiers being stored in the counter table.
    identity = _real_ip(request)
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{policy}|{identity}".encode(), hashlib.sha256
    ).hexdigest()


async def consume(db: AsyncSession, bucket_key: str, spec: str, *, now: datetime | None = None):
    limit, duration = _window(spec)
    database_now = await db.scalar(select(func.now()))
    if database_now.tzinfo is None:
        database_now = database_now.replace(tzinfo=timezone.utc)
    timestamp = now or database_now
    window_end = timestamp + duration
    table = RateLimitBucket.__table__
    dialect = db.bind.dialect.name
    insert = pg_insert if dialect == "postgresql" else sqlite_insert
    stmt = insert(RateLimitBucket).values(bucket_key=bucket_key, count=1, reset_at=window_end)
    expired = table.c.reset_at <= func.now()
    count = case(
        (expired, 1), else_=case((table.c.count < limit + 1, table.c.count + 1), else_=limit + 1)
    )
    reset = case((expired, window_end), else_=table.c.reset_at)
    stmt = stmt.on_conflict_do_update(
        index_elements=[table.c.bucket_key], set_={"count": count, "reset_at": reset}
    ).returning(table.c.count, table.c.reset_at)
    row = (await db.execute(stmt)).one()
    await db.commit()
    reset_at = (
        row.reset_at.replace(tzinfo=timezone.utc) if row.reset_at.tzinfo is None else row.reset_at
    )
    return row.count <= limit, max(1, math.ceil((reset_at - database_now).total_seconds()))


@asynccontextmanager
async def _rate_session(request: Request):
    """Use the app DB in production and honor explicit get_db test overrides."""
    override = request.app.dependency_overrides.get(get_db)
    if override is None:
        async with AsyncSessionLocal() as db:
            yield db
        return
    resource = override()
    if inspect.isawaitable(resource):
        resource = await resource
    if hasattr(resource, "__aiter__"):
        try:
            async for db in resource:
                yield db
                break
        finally:
            await resource.aclose()
    elif hasattr(resource, "__aenter__"):
        async with resource as db:
            yield db
    else:
        yield resource


class _Limiter:
    """Decorator-compatible policy registrar; storage is async PostgreSQL."""

    def __init__(self):
        self._storage = self

    def reset(self):
        # Compatibility for existing test fixtures; rows are isolated by their database lifecycle.
        return None

    def limit(self, value):
        def decorate(endpoint):
            endpoint.__database_rate_limit__ = value
            return endpoint

        return decorate


limiter = _Limiter()


async def purge_expired_buckets(batch_size: int = 1000) -> int:
    """Bound storage growth without putting cleanup on the request path."""
    async with AsyncSessionLocal() as db:
        expired = (
            select(RateLimitBucket.bucket_key)
            .where(RateLimitBucket.reset_at <= func.now())
            .limit(batch_size)
        )
        result = await db.execute(
            delete(RateLimitBucket).where(RateLimitBucket.bucket_key.in_(expired))
        )
        await db.commit()
        return result.rowcount or 0


async def cleanup_expired_buckets_loop() -> None:
    while True:
        try:
            await purge_expired_buckets()
        except Exception:
            import logging

            logging.getLogger(__name__).warning("Rate-limit bucket cleanup failed")
        await asyncio.sleep(300)


class RateLimitedRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        spec = getattr(self.endpoint, "__database_rate_limit__", None)
        if spec is None:
            return original

        @wraps(original)
        async def handler(request: Request):
            try:
                policy = spec(request) if callable(spec) else spec
                async with _rate_session(request) as db:
                    allowed, retry_after = await consume(db, _key(request, self.name), policy)
            except Exception as exc:
                if isinstance(exc, HTTPException):
                    raise
                import logging

                logging.getLogger(__name__).warning("Rate limiting unavailable")
                raise HTTPException(503, "Rate limiting temporarily unavailable") from None
            if not allowed:
                raise HTTPException(
                    429,
                    "Demasiados intentos. Intenta de nuevo más tarde.",
                    headers={"Retry-After": str(retry_after)},
                )
            return await original(request)

        return handler
