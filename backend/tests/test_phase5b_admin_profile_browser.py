"""Base admin profile recovery through isolated PostgreSQL; no signature writes."""

import os

import pytest
from app.modules.users.models import Profile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_admin_profile_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-admin-profile-browser.mjs",
    )
    async with async_sessionmaker(integration_engine)() as db:
        for role in ["admin", "app_admin"]:
            profile = (
                await db.execute(
                    select(Profile).where(Profile.user_id == integration_accounts[role])
                )
            ).scalar_one()
            assert profile.job_title == "Reintento explicito"
            if role == "admin":
                assert profile.program == "Medicina"
                assert profile.campus == "Bogotá"
