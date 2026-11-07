"""Reproducible, non-destructive migration on an empty local disposable database."""

import asyncio
import os
import uuid

import pytest
from alembic import command
from alembic.config import Config
from app.core.config import settings
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine


def test_session_migration_preserves_credentials(monkeypatch):
    url = os.getenv("PHASE2_POSTGRES_URL")
    if not url:
        pytest.skip("PHASE2_POSTGRES_URL: empty local disposable database required")
    parsed = make_url(url)
    assert parsed.host in ("localhost", "127.0.0.1")
    assert (parsed.database or "").startswith("immuno_phase2_")
    monkeypatch.setattr(settings, "DATABASE_URL", url)

    async def query(sql, params=None):
        engine = create_async_engine(url)
        try:
            async with engine.begin() as connection:
                result = await connection.execute(text(sql), params or {})
                return list(result.mappings()) if result.returns_rows else []
        finally:
            await engine.dispose()

    def run(sql, params=None):
        return asyncio.run(query(sql, params))

    assert not run("SELECT tablename FROM pg_tables WHERE schemaname='public'")
    config = Config("alembic.ini")
    command.upgrade(config, "2026_09_26_0100")
    params = {"user": uuid.uuid4(), "token": uuid.uuid4()}
    run(
        """INSERT INTO users (id,email,hashed_password,role,is_active,must_change_password)
           VALUES (:user,'synthetic@example.invalid','synthetic-hash','STUDENT',true,false)""",
        params,
    )
    run(
        """INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at,revoked,created_at)
           VALUES (:token,:user,'synthetic-token-hash',now()+interval '1 day',false,now())""",
        params,
    )
    before = dict(run("SELECT * FROM refresh_tokens")[0])
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    after = dict(run("SELECT * FROM refresh_tokens")[0])
    assert {key: after[key] for key in before} == before
    assert after["session_id"] is None and after["generation"] == 0
    assert run("SELECT auth_version,hashed_password FROM users")[0] == {
        "auth_version": 0,
        "hashed_password": "synthetic-hash",
    }
    for table in ("auth_sessions", "web_sessions"):
        assert run(f"SELECT count(*) AS n FROM {table}")[0]["n"] == 0
