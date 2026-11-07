import pytest
from app.modules.notifications.repository import NotificationRepository
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase2_sessions import headers, login


@pytest.mark.asyncio
async def test_device_reassignment_and_old_logout_cannot_disable_new_owner(
    integration_client, integration_accounts, integration_engine
):
    client = integration_client
    a, b = await login(client), await login(client, "other")
    body = {"token": "synthetic-device-token", "platform": "android"}
    for pair in (a, b):
        assert (
            await client.post(
                "/api/v1/notifications/device-token", headers=headers(pair), json=body
            )
        ).status_code == 200
    assert (
        await client.request(
            "DELETE", "/api/v1/notifications/device-token", headers=headers(a), json=body
        )
    ).status_code == 200
    await client.post("/api/v2/auth/logout", json={"refresh_token": a["refresh_token"]})
    async with async_sessionmaker(integration_engine)() as db:
        repo = NotificationRepository(db)
        assert await repo.get_active_tokens_by_user(integration_accounts["student"]) == []
        assert await repo.get_active_tokens_by_user(integration_accounts["other"]) == [
            "synthetic-device-token"
        ]
    await client.post("/api/v2/auth/logout", json={"refresh_token": b["refresh_token"]})
    async with async_sessionmaker(integration_engine)() as db:
        assert (
            await NotificationRepository(db).get_active_tokens_by_user(
                integration_accounts["other"]
            )
            == []
        )


@pytest.mark.asyncio
async def test_push_transport_never_includes_clinical_input(monkeypatch):
    from app.modules.notifications import push

    captured = []
    monkeypatch.setattr(push, "_firebase_app", lambda: object())
    monkeypatch.setattr(
        push.messaging, "send_each_for_multicast", lambda message, app: captured.append(message)
    )
    await push.PushNotificationSender().send_to_tokens(
        ["synthetic-token"],
        title="SENSITIVE NAME",
        body="SENSITIVE DOSE",
        data={"diagnosis": "SENSITIVE VALUE"},
    )
    message = captured[0]
    assert message.data == {"event": "updates_available"}
    assert "SENSITIVE" not in message.notification.title + message.notification.body
