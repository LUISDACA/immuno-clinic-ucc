"""Paired visual scenarios with synthetic notification fixtures only."""

import json
import os
from datetime import datetime
from pathlib import Path

import pytest
from app.modules.notifications.models import Notification
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_notifications_visual_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    root = Path(__file__).resolve().parents[2]
    fixture = json.loads((root / "docs/ui/fixtures/phase5b-notifications.json").read_text())
    async with async_sessionmaker(integration_engine)() as db:
        for role in ["student", "admin"]:
            for item in fixture:
                db.add(
                    Notification(
                        user_id=integration_accounts[role],
                        title=item["title"],
                        message=item["message"],
                        category=item["category"],
                        is_read=item["is_read"],
                        created_at=datetime.fromisoformat(item["created_at"]),
                    )
                )
        await db.commit()
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-notifications-browser.mjs",
    )
