"""Control semantics with synthetic records and the real browser/PostgreSQL harness."""

import os
from datetime import datetime, timezone

import pytest
from app.modules.notifications.models import Notification
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_controls_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    async with async_sessionmaker(integration_engine)() as db:
        for role in ["student", "admin"]:
            for number in [1, 2]:
                db.add(
                    Notification(
                        user_id=integration_accounts[role],
                        title=f"Synthetic notice {number}",
                        message="Synthetic message without health data",
                        category="system",
                        is_read=False,
                        created_at=datetime(2026, 10, 9, 12, tzinfo=timezone.utc),
                    )
                )
        await db.commit()
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-controls-browser.mjs",
    )
