"""Real HTTP session controls; PostgreSQL required for concurrent writers."""

import asyncio

import pytest
from app.modules.auth.models import AuthSession, RefreshToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker


async def login(client, name="student", version=2):
    response = await client.post(
        f"/api/v{version}/auth/login",
        json={"email": f"{name}@example.com", "password": "SyntheticOnly123!"},
    )
    assert response.status_code == 200
    return response.json()


def headers(pair):
    return {"Authorization": "Bearer " + pair["access_token"]}


@pytest.mark.asyncio
async def test_rotation_replay_revokes_access_and_preserves_other_family(
    integration_client, integration_accounts, integration_engine
):
    client = integration_client
    first = await login(client)
    other = await login(client)
    rotated = await client.post(
        "/api/v2/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert rotated.status_code == 200
    pair = rotated.json()
    assert (
        pair["refresh_token"] != first["refresh_token"]
        and pair["session_id"] == first["session_id"]
    )
    assert rotated.headers["cache-control"] == "no-store"
    assert (await client.get("/api/v1/users/me", headers=headers(pair))).status_code == 200
    replay = await client.post(
        "/api/v2/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert replay.status_code == 401 and replay.json()["code"] == "SESSION_INVALID"
    assert (await client.get("/api/v1/users/me", headers=headers(pair))).status_code == 401
    assert (await client.get("/api/v1/users/me", headers=headers(other))).status_code == 200
    async with async_sessionmaker(integration_engine)() as db:
        families = (await db.scalars(select(AuthSession))).all()
        assert sorted(s.status for s in families) == ["ACTIVE", "COMPROMISED"]
        assert len((await db.scalars(select(RefreshToken))).all()) == 3


@pytest.mark.asyncio
async def test_concurrent_refresh_has_one_success_then_compromised_family(
    integration_client, integration_accounts, integration_engine
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row locks required")
    pair = await login(integration_client)

    async def refresh():
        return await integration_client.post(
            "/api/v2/auth/refresh", json={"refresh_token": pair["refresh_token"]}
        )

    results = await asyncio.wait_for(asyncio.gather(refresh(), refresh()), 10)
    assert sorted(r.status_code for r in results) == [200, 401]
    successor = next(r.json() for r in results if r.status_code == 200)
    assert (
        await integration_client.get("/api/v1/users/me", headers=headers(successor))
    ).status_code == 401


@pytest.mark.asyncio
async def test_logout_consumed_member_and_protocol_isolation(
    integration_client, integration_accounts
):
    client = integration_client
    pair = await login(client)
    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": pair["refresh_token"]})
    ).status_code == 401
    rotated = (
        await client.post("/api/v2/auth/refresh", json={"refresh_token": pair["refresh_token"]})
    ).json()
    for _ in range(2):
        assert (
            await client.post("/api/v2/auth/logout", json={"refresh_token": pair["refresh_token"]})
        ).status_code == 204
    assert (await client.get("/api/v1/users/me", headers=headers(rotated))).status_code == 401
    legacy = await login(client, version=1)
    for _ in range(2):
        assert (
            await client.post(
                "/api/v1/auth/refresh", json={"refresh_token": legacy["refresh_token"]}
            )
        ).status_code == 200
    assert (
        await client.post("/api/v2/auth/refresh", json={"refresh_token": legacy["refresh_token"]})
    ).status_code == 401


@pytest.mark.asyncio
async def test_session_revoke_permission_and_validation_redaction(
    integration_client, integration_accounts
):
    client = integration_client
    pair, other = await login(client), await login(client, "other")
    path = "/api/v2/auth/sessions/" + pair["session_id"]
    assert (await client.delete(path, headers=headers(other))).status_code == 401
    assert (await client.delete(path, headers=headers(pair))).status_code == 204
    assert (await client.get("/api/v1/users/me", headers=headers(pair))).status_code == 401
    result = await client.post(
        "/api/v2/auth/refresh", json={"refresh_token": {"secret": "synthetic-marker"}}
    )
    assert result.status_code == 422 and "synthetic-marker" not in result.text
    student = await login(client)
    marker = "synthetic-marker-" * 10
    result = await client.post(
        "/api/v1/communications/recipients/search",
        headers=headers(student),
        json={"target": "students", "search": marker},
    )
    assert result.status_code == 422 and marker not in result.text


async def reset_links(engine, user_id):
    from datetime import timedelta

    from app.modules.auth.models import PasswordResetToken
    from app.modules.auth.sessions import digest, now

    async with async_sessionmaker(engine)() as db:
        for raw in ("synthetic-reset-one", "synthetic-reset-two"):
            db.add(
                PasswordResetToken(
                    user_id=user_id,
                    token_hash=digest(raw),
                    expires_at=now() + timedelta(hours=1),
                    created_at=now(),
                    used=False,
                )
            )
        await db.commit()
    return ["synthetic-reset-one", "synthetic-reset-two"]


@pytest.mark.asyncio
async def test_distinct_reset_links_only_one_can_change_password(
    integration_client, integration_accounts, integration_engine
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row locks required")
    pair = await login(integration_client)
    links = await reset_links(integration_engine, integration_accounts["student"])

    async def reset(raw):
        return await integration_client.post(
            "/api/v1/auth/reset-password",
            json={"token": raw, "new_password": "SyntheticChanged456!"},
        )

    results = await asyncio.wait_for(asyncio.gather(*(reset(raw) for raw in links)), 10)
    assert sorted(r.status_code for r in results) == [200, 400]
    assert (
        await integration_client.get("/api/v1/users/me", headers=headers(pair))
    ).status_code == 401
    assert (
        await integration_client.post(
            "/api/v2/auth/refresh", json={"refresh_token": pair["refresh_token"]}
        )
    ).status_code == 401
    result = await integration_client.post(
        "/api/v2/auth/login",
        json={"email": "student@example.com", "password": "SyntheticChanged456!"},
    )
    assert result.status_code == 200


@pytest.mark.asyncio
async def test_password_change_revokes_all_families_and_pending_reset(
    integration_client, integration_accounts, integration_engine
):
    client = integration_client
    one, two = await login(client), await login(client)
    links = await reset_links(integration_engine, integration_accounts["student"])
    result = await client.post(
        "/api/v1/auth/change-password",
        headers=headers(one),
        json={"current_password": "SyntheticOnly123!", "new_password": "SyntheticChanged456!"},
    )
    assert result.status_code == 200
    for pair in (one, two):
        assert (await client.get("/api/v1/users/me", headers=headers(pair))).status_code == 401
    for raw in links:
        assert (
            await client.post(
                "/api/v1/auth/reset-password",
                json={"token": raw, "new_password": "SyntheticOther789!"},
            )
        ).status_code == 400
