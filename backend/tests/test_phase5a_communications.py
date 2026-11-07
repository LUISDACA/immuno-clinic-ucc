"""Contract flow used by both clients, with real HTTP permissions."""

import pytest

from tests.test_phase1_e2e import login


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "sender,target,field",
    [
        ("student", "admin", "admin_id"),
        ("admin", "student", "student_id"),
        ("admin", "app_admin", "admin_id"),
        ("app_admin", "admin", "admin_id"),
    ],
)
async def test_conversation_create_reply_close_reopen(
    integration_client, integration_accounts, sender, target, field
):
    client = integration_client
    author, _ = await login(client, sender, 2)
    recipient, _ = await login(client, target, 2)
    outside, _ = await login(client, "outside", 2)
    response = await client.post(
        "/api/v1/communications/threads",
        headers=author,
        json={
            field: str(integration_accounts[target]),
            "subject": "Synthetic subject",
            "message": "Synthetic body",
            "category": "general",
        },
    )
    assert response.status_code == 200
    path = "/api/v1/communications/threads/" + response.json()["id"]
    assert (await client.get(path, headers=recipient)).status_code == 200
    assert (await client.get(path, headers=outside)).status_code == 403
    assert (
        await client.put(path + "/status", headers=outside, json={"status": "closed"})
    ).status_code == 403
    assert (await client.put(path + "/status", headers=author, json={"status": "closed"})).json()[
        "status"
    ] == "closed"
    reply = await client.post(
        path + "/messages", headers=recipient, json={"message": "Synthetic reply"}
    )
    assert reply.status_code in (200, 201)
    assert reply.json()["status"] == "open"
    assert (
        await client.put(path + "/status", headers=author, json={"status": "closed"})
    ).status_code == 200
    assert (await client.put(path + "/status", headers=author, json={"status": "open"})).json()[
        "status"
    ] == "open"
