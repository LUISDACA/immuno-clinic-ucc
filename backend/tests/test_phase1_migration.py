"""Opt-in verification on an EMPTY disposable PostgreSQL database.

Set PHASE1_POSTGRES_URL to a local DB named immuno_phase1_*; never production.
The database is left intact for inspection. No downgrade or DROP is performed.
"""

import asyncio
import os
import uuid

import pytest
from alembic import command
from alembic.config import Config
from app.common.enums import DoseStatus
from app.core.config import settings
from app.core.exceptions import ConflictException
from app.modules.vaccination_scheme.models import StudentVaccineDose
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.schemas import UpdateDoseRequest
from app.modules.vaccination_scheme.service import SchemeService
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


def test_archive_migration_preserves_existing_rows(monkeypatch):
    url = os.environ.get("PHASE1_POSTGRES_URL")
    if not url:
        pytest.skip("PHASE1_POSTGRES_URL is required for disposable PostgreSQL verification")
    parsed = make_url(url)
    assert (parsed.database or "").startswith("immuno_phase1_")
    assert parsed.host in (None, "localhost", "127.0.0.1")
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    config = Config("alembic.ini")

    async def query(sql, params=None):
        engine = create_async_engine(url)
        try:
            async with engine.begin() as conn:
                result = await conn.execute(text(sql), params or {})
                return [dict(row) for row in result.mappings()] if result.returns_rows else []
        finally:
            await engine.dispose()

    def run(sql, params=None):
        return asyncio.run(query(sql, params))

    assert not run("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"), (
        "Use an empty disposable database"
    )
    command.upgrade(config, "2026_05_07_0100")
    ids = {
        key: uuid.uuid4() for key in ("user", "vaccine", "config", "assignment", "dose", "batch")
    }
    run(
        """INSERT INTO users (id,email,hashed_password,role,is_active,must_change_password)
           VALUES (:user,'synthetic@example.invalid','unusable-synthetic-hash','STUDENT',true,false)""",
        ids,
    )
    run(
        """INSERT INTO vaccines
           (id,name,code,base_doses,has_booster,has_titer,has_titer_value,is_annual,applies_to,is_active,display_order)
           VALUES (:vaccine,'Synthetic','SYNTHETIC',1,false,false,false,false,'ALL',true,0)""",
        ids,
    )
    run(
        """INSERT INTO vaccine_dose_configs
           (id,vaccine_id,dose_number,label,is_required,applies_to,dose_type)
           VALUES (:config,:vaccine,1,'Synthetic',true,'ALL','STANDARD')""",
        ids,
    )
    run(
        """INSERT INTO student_vaccines (id,user_id,vaccine_id,status)
           VALUES (:assignment,:user,:vaccine,'APPROVED')""",
        ids,
    )
    run(
        """INSERT INTO student_vaccine_doses
           (id,student_vaccine_id,dose_config_id,dose_number,status,applied_date,admin_notes,reviewed_by,reviewed_at)
           VALUES (:dose,:assignment,:config,1,'APPROVED','2026-01-01','Synthetic review',:user,now())""",
        ids,
    )
    run(
        """INSERT INTO evidence_batches (id,user_id,status,notes)
           VALUES (:batch,:user,'REVIEWED','Synthetic evidence metadata')""",
        ids,
    )
    tables = (
        "vaccine_dose_configs",
        "student_vaccines",
        "student_vaccine_doses",
        "evidence_batches",
    )
    before = {table: run(f"SELECT * FROM {table}") for table in tables}
    command.upgrade(config, "head")
    command.upgrade(config, "head")  # Re-running deploy migration is a no-op.
    for table in tables:
        after = run(f"SELECT * FROM {table}")
        if table != "evidence_batches":
            assert all(row.pop("is_active") is True for row in after)
            assert after == before[table]
        else:
            for row in after:
                assert row["reviewed_by"] is None
                assert row["reviewed_at"] is None
                for key, value in before[table][0].items():
                    assert row[key] == value

    assert run(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
        "AND tablename='student_scheme_versions'"
    )
    assert run(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='vaccine_rules' AND column_name='is_active'"
    )
    assert run(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='evidence_batches' AND column_name='dose_id'"
    )
    assert (
        run(
            "SELECT count(*) AS count FROM evidence_batches WHERE id=:batch AND dose_id IS NULL",
            ids,
        )[0]["count"]
        == 1
    )
    evidence_labels = {
        row["enumlabel"]
        for row in run(
            "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid "
            "WHERE t.typname='evidence_batch_status_enum'"
        )
    }
    assert {"IN_REVIEW", "APPROVED", "DENIED", "REVIEWED"} <= evidence_labels

    async def verify_concurrent_approval():
        engine = create_async_engine(url)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text("UPDATE student_vaccine_doses SET status = 'IN_REVIEW' WHERE id = :dose"),
                    ids,
                )
            async with sessions() as editor, sessions() as reviewer:
                # Simulate a request which loaded the dose before the approval.
                stale = await editor.get(StudentVaccineDose, ids["dose"])
                assert stale.status == DoseStatus.IN_REVIEW
                locked = await SchemeRepository(reviewer).get_dose_by_id(ids["dose"])
                locked.status = DoseStatus.APPROVED
                await reviewer.flush()
                service = SchemeService(SchemeRepository(editor), VaccineRepository(editor))
                update = asyncio.create_task(
                    service.update_dose(
                        ids["dose"], ids["user"], UpdateDoseRequest(applied_date=None)
                    )
                )
                with pytest.raises(TimeoutError):
                    await asyncio.wait_for(asyncio.shield(update), timeout=0.2)
                await reviewer.commit()
                with pytest.raises(ConflictException):
                    await asyncio.wait_for(update, timeout=5)
                assert stale.status == DoseStatus.APPROVED
                assert stale.applied_date.isoformat() == "2026-01-01"
        finally:
            await engine.dispose()

    asyncio.run(verify_concurrent_approval())
