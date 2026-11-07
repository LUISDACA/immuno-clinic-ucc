"""Real local SMTP; no external mail credentials or delivery assumed."""

import pytest
from app.core.config import settings
from app.core.email import (
    EmailDeliveryStatus,
    send_account_created_email,
    send_password_reset_email,
    send_vaccine_due_email,
)


@pytest.mark.asyncio
async def test_three_flows_reach_local_smtp(smtp_inbox):
    assert (
        await send_account_created_email(
            "synthetic@example.com",
            full_name="Synthetic <script>name</script>",
            temporary_password="SyntheticOnly123!",
        )
        == EmailDeliveryStatus.ACCEPTED
    )
    assert (
        await send_password_reset_email("synthetic@example.com", "synthetic-reset-only")
        == EmailDeliveryStatus.ACCEPTED
    )
    assert (
        await send_vaccine_due_email(
            "synthetic@example.com",
            full_name="Synthetic",
            vaccine_name="Synthetic vaccine",
            dose_label="First",
            due_date="01/01/2027",
            days_until_due=1,
        )
        == EmailDeliveryStatus.ACCEPTED
    )
    assert len(smtp_inbox.messages) == 3
    bodies = [
        message.get_body(preferencelist=("html",)).get_content() for message in smtp_inbox.messages
    ]
    assert "SyntheticOnly123!" in bodies[0]
    assert "<script>name</script>" not in bodies[0]
    assert "&lt;script&gt;" in bodies[0]
    assert "https://app.example.com/reset-password?token=synthetic-reset-only" in bodies[1]
    assert "Synthetic vaccine" in bodies[2]


@pytest.mark.asyncio
async def test_disabled_and_rejected_mail_do_not_log_tokens_or_recipient(
    smtp_inbox, monkeypatch, caplog
):
    token = "synthetic-reset-do-not-log"
    recipient = "synthetic-private@example.com"
    monkeypatch.setattr(settings, "EMAIL_ENABLED", False)
    assert await send_password_reset_email(recipient, token) == EmailDeliveryStatus.DISABLED
    assert smtp_inbox.messages == []
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    smtp_inbox.reject = True
    assert await send_password_reset_email(recipient, token) == EmailDeliveryStatus.FAILED
    assert smtp_inbox.messages == []
    assert token not in caplog.text and token[:8] not in caplog.text
    assert recipient not in caplog.text


@pytest.mark.asyncio
async def test_transport_failure_and_missing_template_return_failed(smtp_inbox, monkeypatch):
    from app.core.email import send_email

    assert (
        await send_email("Synthetic", "synthetic@example.com", "missing.html", {})
        == EmailDeliveryStatus.FAILED
    )
    monkeypatch.setattr(settings, "SMTP_PORT", 1)
    assert (
        await send_password_reset_email("synthetic@example.com", "synthetic-reset")
        == EmailDeliveryStatus.FAILED
    )


@pytest.mark.asyncio
async def test_sendgrid_failure_falls_back_to_local_smtp_without_logging_payload(
    smtp_inbox, monkeypatch, caplog
):
    import sendgrid

    class FailingProvider:
        def __init__(self, key):
            pass

        def send(self, message):
            raise RuntimeError("synthetic-provider-sensitive-canary")

    monkeypatch.setattr(settings, "SENDGRID_API_KEY", "synthetic-no-real-key")
    monkeypatch.setattr(sendgrid, "SendGridAPIClient", FailingProvider)
    assert (
        await send_password_reset_email("synthetic@example.com", "synthetic-reset")
        == EmailDeliveryStatus.ACCEPTED
    )
    assert len(smtp_inbox.messages) == 1
    assert "synthetic-provider-sensitive-canary" not in caplog.text
