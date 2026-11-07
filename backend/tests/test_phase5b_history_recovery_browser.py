"""History retry/pagination: real local PostgreSQL and synthetic authorized events."""

import os
from datetime import datetime, timedelta, timezone

import pytest
from app.modules.audit.models import AuditLog
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_history_recovery_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    async with async_sessionmaker(integration_engine)() as db:
        for i in range(45):
            db.add(
                AuditLog(
                    actor_id=integration_accounts["admin"],
                    target_type="user",
                    target_id=integration_accounts["student"],
                    action="profile.updated",
                    details={
                        "student_id": str(integration_accounts["student"]),
                        "notes": "Synthetic authorized history",
                    },
                    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=i),
                )
            )
        db.add(
            AuditLog(
                actor_id=integration_accounts["outside"],
                target_type="user",
                target_id=integration_accounts["outside"],
                action="profile.updated",
                details={"notes": "Synthetic outside scope history"},
                created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
            )
        )
        await db.commit()
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-history-recovery-browser.mjs",
    )
