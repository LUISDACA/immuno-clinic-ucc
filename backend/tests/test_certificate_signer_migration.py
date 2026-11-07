"""Opt-in migration test: reports legacy ambiguity without inferring an owner."""

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


def test_migration_reports_ambiguous_legacy_scope_without_assignment(monkeypatch):
    url = os.getenv("PHASE4_SIGNER_POSTGRES_URL")
    if not url:
        pytest.skip("PHASE4_SIGNER_POSTGRES_URL must point to an isolated synthetic DB")
    parsed = make_url(url)
    assert (parsed.database or "").startswith("immuno_phase4_")
    assert parsed.host in (None, "localhost", "127.0.0.1")
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    config = Config("alembic.ini")

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
    command.upgrade(config, "2026_09_28_0300")
    ids = [uuid.uuid4(), uuid.uuid4()]
    for user_id in ids:
        run(
            """INSERT INTO users (id,email,hashed_password,role,is_active,must_change_password)
               VALUES (:id,:email,'synthetic-only','ADMIN',true,false)""",
            {"id": user_id, "email": f"legacy-{user_id}@example.invalid"},
        )
        run(
            """INSERT INTO profiles
               (id,user_id,first_name,last_name,sex,program,campus,created_at,updated_at)
               VALUES (:profile,:id,'Synthetic','Admin','MALE','Medicina','Bogotá',now(),now())""",
            {"profile": uuid.uuid4(), "id": user_id},
        )

    command.upgrade(config, "head")
    command.upgrade(config, "head")
    report = run(
        "SELECT admin_ids FROM certificate_signer_assignment_conflicts "
        "WHERE program='Medicina' AND campus='Bogotá'"
    )
    assert len(report) == 1
    assert set(report[0]["admin_ids"]) == {str(value) for value in ids}
    assert run("SELECT id FROM certificate_signer_assignments") == []
