"""Synthetic create/import through real browser/BFF/API/PostgreSQL; email disabled."""

import os
from datetime import date

import pytest
from app.core.config import settings
from app.modules.users.models import Profile, User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_student_create_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    assert settings.EMAIL_ENABLED is False
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-student-create-browser.mjs",
    )
    async with async_sessionmaker(integration_engine)() as db:
        for email, birth_date in [
            ("manual-ui@example.com", date(2001, 2, 28)),
            ("import-ui@example.com", date(2000, 2, 29)),
        ]:
            profile = (
                await db.execute(
                    select(Profile)
                    .join(User, User.id == Profile.user_id)
                    .where(User.email == email)
                )
            ).scalar_one()
            assert profile.birth_date == birth_date
            assert profile.program == "Medicina"
            assert profile.campus == "Bogotá"
