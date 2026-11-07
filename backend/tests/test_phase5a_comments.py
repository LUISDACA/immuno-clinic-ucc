"""Real HTTP authorization and intent separation; synthetic accounts only."""

import asyncio

import pytest
from app.modules.audit.models import AuditLog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase1_e2e import catalog, login


@pytest.mark.asyncio
async def test_comment_never_reviews_dose(
    integration_client, integration_engine, integration_accounts
):
    client = integration_client
    await catalog(integration_engine, integration_accounts)
    student, _ = await login(client, "student", 2)
    admin, _ = await login(client, "admin", 2)
    outsider, _ = await login(client, "outside", 2)

    async def dose():
        response = await client.get("/api/v1/scheme/", headers=student)
        return response.json()["vaccines"][0]["doses"][0]

    initial = await dose()
    path = f"/api/v1/admin/doses/{initial['id']}"
    for headers in (student, outsider):
        assert (
            await client.patch(
                path + "/comment", headers=headers, json={"admin_notes": "Synthetic"}
            )
        ).status_code == 403
        assert (
            await client.put(path + "/review", headers=headers, json={"status": "approved"})
        ).status_code == 403
    assert (await client.patch(path + "/comment", json={"admin_notes": None})).status_code == 401
    assert (
        await client.patch(
            path + "/comment",
            headers=admin,
            json={"admin_notes": "Synthetic", "status": "approved"},
        )
    ).status_code == 422
    assert (await client.patch(path + "/comment", headers=admin, json={})).status_code == 422
    for state in ("in_review", "approved", "denied"):
        result = await client.put(path + "/review", headers=admin, json={"status": state})
        assert result.status_code == 200
        before = await dose()
        for notes in ("Synthetic comment", None):
            result = await client.patch(
                path + "/comment", headers=admin, json={"admin_notes": notes}
            )
            assert result.status_code == 200
            after = await dose()
            assert after["admin_notes"] == notes
            for field in ("status", "reviewed_by", "reviewed_at", "applied_date", "due_date"):
                assert after[field] == before[field]
    async with async_sessionmaker(integration_engine)() as db:
        entries = (
            (await db.execute(select(AuditLog).where(AuditLog.action == "dose.comment_updated")))
            .scalars()
            .all()
        )
        assert len(entries) == 6
        assert all(entry.actor_id == integration_accounts["admin"] for entry in entries)
        assert all("notes" not in entry.details for entry in entries)


@pytest.mark.asyncio
async def test_comment_concurrent_with_review_preserves_explicit_decision(
    integration_client, integration_engine, integration_accounts
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    await catalog(integration_engine, integration_accounts)
    student, _ = await login(integration_client, "student", 2)
    admin, _ = await login(integration_client, "admin", 2)
    scheme = (await integration_client.get("/api/v1/scheme/", headers=student)).json()
    dose_id = scheme["vaccines"][0]["doses"][0]["id"]
    path = f"/api/v1/admin/doses/{dose_id}"
    responses = await asyncio.gather(
        integration_client.patch(
            path + "/comment", headers=admin, json={"admin_notes": "Synthetic concurrent"}
        ),
        integration_client.put(path + "/review", headers=admin, json={"status": "denied"}),
    )
    assert all(r.status_code == 200 for r in responses)
    scheme = (await integration_client.get("/api/v1/scheme/", headers=student)).json()
    assert scheme["vaccines"][0]["doses"][0]["status"] == "denied"


@pytest.mark.asyncio
async def test_comment_rollback_if_audit_fails(
    integration_client, integration_engine, integration_accounts, monkeypatch
):
    from app.modules.audit.service import AuditService

    await catalog(integration_engine, integration_accounts)
    student, _ = await login(integration_client, "student", 2)
    admin, _ = await login(integration_client, "app_admin", 2)

    async def read_dose():
        return (await integration_client.get("/api/v1/scheme/", headers=student)).json()[
            "vaccines"
        ][0]["doses"][0]

    before = await read_dose()
    path = f"/api/v1/admin/doses/{before['id']}/comment"

    async def fail(*args, **kwargs):
        raise RuntimeError("Synthetic audit failure")

    with monkeypatch.context() as patch:
        patch.setattr(AuditService, "log", fail)
        with pytest.raises(RuntimeError, match="Synthetic audit failure"):
            await integration_client.patch(
                path, headers=admin, json={"admin_notes": "Must rollback"}
            )
    assert (await read_dose())["admin_notes"] == before["admin_notes"]
    assert (
        await integration_client.patch(
            path, headers=admin, json={"admin_notes": "Synthetic app admin comment"}
        )
    ).status_code == 200
    after = await read_dose()
    assert after["status"] == before["status"]
