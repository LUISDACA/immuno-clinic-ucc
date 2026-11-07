"""Trusted proxy parsing and multi-worker PostgreSQL fixed windows."""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from app.core.config import settings
from app.core.rate_limit import _real_ip, consume
from app.modules.auth.models import RateLimitBucket
from sqlalchemy.ext.asyncio import async_sessionmaker


@pytest.mark.asyncio
async def test_rotating_login_route_enforces_shared_rate_policy(integration_client):
    responses = []
    for _ in range(6):
        responses.append(
            await integration_client.post(
                "/api/v2/auth/login",
                json={
                    "email": "synthetic-missing@example.com",
                    "password": "SyntheticOnly123!",
                },
            )
        )
    assert [response.status_code for response in responses] == [401] * 5 + [429]
    assert responses[-1].headers.get("retry-after")
    assert "synthetic-missing" not in responses[-1].text


class Client:
    def __init__(self, host):
        self.host = host


class Request:
    def __init__(self, peer, xff):
        self.client = Client(peer)
        self.headers = {"x-forwarded-for": xff} if xff is not None else {}


def test_untrusted_forwarded_header_is_ignored(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_CIDRS", [])
    assert _real_ip(Request("198.51.100.9", "203.0.113.44")) == "198.51.100.9"


def test_forwarded_chain_walks_from_the_trusted_peer(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_CIDRS", ["10.0.0.0/8"])
    assert _real_ip(Request("10.0.0.1", "203.0.113.44, 10.0.0.2")) == "203.0.113.44"
    assert _real_ip(Request("10.0.0.1", "garbage, 10.0.0.2")) == "10.0.0.1"
    assert _real_ip(Request("198.51.100.9", "203.0.113.44")) == "198.51.100.9"


@pytest.mark.asyncio
async def test_postgres_window_is_atomic_across_independent_connections(integration_engine):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL required to demonstrate cross-worker row locking")
    sessions = async_sessionmaker(integration_engine, expire_on_commit=False)
    bucket = "phase2-" + uuid.uuid4().hex

    async def attempt():
        async with sessions() as db:
            return await consume(db, bucket, "3/minute")

    results = await asyncio.wait_for(asyncio.gather(*(attempt() for _ in range(12))), 10)
    assert sum(allowed for allowed, _ in results) == 3
    async with sessions() as db:
        row = await db.get(RateLimitBucket, bucket)
        assert row.count == 4
        assert row.bucket_key == bucket


@pytest.mark.asyncio
async def test_expired_window_resets_atomically(integration_engine):
    sessions = async_sessionmaker(integration_engine, expire_on_commit=False)
    bucket = "phase2-expired-" + uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    async with sessions() as db:
        await db.execute(
            RateLimitBucket.__table__.insert().values(
                bucket_key=bucket, count=50, reset_at=now - timedelta(seconds=1)
            )
        )
        await db.commit()
    async with sessions() as db:
        allowed, _ = await consume(db, bucket, "2/minute")
    assert allowed
    async with sessions() as db:
        assert (await db.get(RateLimitBucket, bucket)).count == 1
