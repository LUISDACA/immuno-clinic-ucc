"""Conversation layering in a real browser with synthetic local PostgreSQL only."""

import os

import pytest

from tests.test_phase5a_browser import test_browser_comment_review_permissions as run_browser_flow


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_communications_layers_browser(
    integration_client, integration_engine, integration_accounts, tmp_path
):
    await run_browser_flow(
        integration_client,
        integration_engine,
        integration_accounts,
        tmp_path,
        flow="phase5b-communications-layers-browser.mjs",
    )
