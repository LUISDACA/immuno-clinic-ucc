"""Dashboard semester context presentation, synthetic PostgreSQL and real Chrome only."""

import os

import pytest

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_dashboard_context_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-dashboard-context-browser.mjs",
    )
