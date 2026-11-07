"""Page contracts and unchanged visibility over synthetic PostgreSQL."""

import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from app.modules.audit.models import AuditLog
from app.modules.evidence.models import EvidenceBatch
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase1_e2e import login


@pytest.mark.asyncio
async def test_evidence_pages_stable_and_scoped(
    integration_client, integration_engine, integration_accounts
):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ids = sorted([uuid.uuid4() for _ in range(23)], reverse=True)
    async with async_sessionmaker(integration_engine)() as db:
        db.add_all(
            [
                EvidenceBatch(id=i, user_id=integration_accounts["student"], created_at=now)
                for i in ids
            ]
        )
        db.add(EvidenceBatch(user_id=integration_accounts["other"], created_at=now))
        await db.commit()
    student, _ = await login(integration_client, "student", 2)
    admin, _ = await login(integration_client, "admin", 2)
    outside, _ = await login(integration_client, "outside", 2)
    path = f"/api/v1/admin/students/{integration_accounts['student']}/evidence/page"
    assert (await integration_client.get(path, headers=outside)).status_code == 403
    assert (await integration_client.get(path, headers=student)).status_code == 403
    responses = await asyncio.gather(
        *[
            integration_client.get(
                "/api/v1/evidence/page", headers=student, params={"page": p, "page_size": 5}
            )
            for p in range(1, 6)
        ]
    )
    actual = []
    for p, r in enumerate(responses, 1):
        assert r.status_code == 200
        d = r.json()
        actual.extend(x["id"] for x in d["items"])
        assert (
            d["page"],
            d["page_size"],
            d["total"],
            d["total_pages"],
            d["has_next"],
            d["has_previous"],
        ) == (p, 5, 23, 5, p < 5, p > 1)
    assert actual == list(map(str, ids))
    assert (
        await integration_client.get(path, headers=admin, params={"page": 2, "page_size": 5})
    ).json()["items"] == responses[1].json()["items"]
    empty = await integration_client.get(
        "/api/v1/evidence/page", headers=student, params={"page": 6, "page_size": 5}
    )
    assert empty.json()["items"] == [] and empty.json()["total"] == 23
    assert (
        await integration_client.get(path, headers=admin, params={"page": 0})
    ).status_code == 422


@pytest.mark.asyncio
async def test_audit_counts_only_visible_rows_before_pagination(
    integration_client, integration_engine, integration_accounts
):
    a = integration_accounts
    async with async_sessionmaker(integration_engine)() as db:
        # Newer irrelevant entries must not hide the older authorized entries.
        for _ in range(30):
            db.add(
                AuditLog(
                    actor_id=a["outside"],
                    action="profile.updated",
                    target_type="user",
                    target_id=a["outside"],
                    created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
                )
            )
        for _ in range(12):
            db.add(
                AuditLog(
                    actor_id=a["admin"],
                    action="profile.updated",
                    target_type="user",
                    target_id=a["student"],
                    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                )
            )
        db.add(
            AuditLog(
                actor_id=a["outside"],
                action="password.changed",
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                target_type="user",
                target_id=a["student"],
            )
        )
        await db.commit()
    admin, _ = await login(integration_client, "admin", 2)
    student, _ = await login(integration_client, "student", 2)
    assert (
        await integration_client.get("/api/v1/audit/admin/page", headers=student)
    ).status_code == 403
    first = (
        await integration_client.get(
            "/api/v1/audit/admin/page", headers=admin, params={"page_size": 5}
        )
    ).json()
    second = (
        await integration_client.get(
            "/api/v1/audit/admin/page", headers=admin, params={"page_size": 5, "page": 2}
        )
    ).json()
    assert first["total"] == 12 and first["total_pages"] == 3
    assert len(first["items"]) == 5 and len(second["items"]) == 5
    assert not ({x["id"] for x in first["items"]} & {x["id"] for x in second["items"]})
    assert all(x["actor"]["id"] == str(a["admin"]) for x in first["items"])


@pytest.mark.asyncio
async def test_student_pages_match_metadata_and_permissions(
    integration_client, integration_accounts
):
    admin, _ = await login(integration_client, "admin", 2)
    student, _ = await login(integration_client, "student", 2)
    path = "/api/v1/admin/students/search"
    assert (
        await integration_client.post(path, headers=student, json={"page_size": 1})
    ).status_code == 403
    results = await asyncio.gather(
        *[
            integration_client.post(path, headers=admin, json={"page_size": 1, "page": p})
            for p in (1, 2)
        ]
    )
    pages = [r.json() for r in results]
    assert pages[0]["total"] == 2 and pages[0]["total_pages"] == 2
    assert pages[0]["has_next"] and pages[1]["has_previous"]
    assert pages[0]["items"][0]["id"] != pages[1]["items"][0]["id"]
    empty = (
        await integration_client.post(
            path, headers=admin, json={"search": "no synthetic match", "page_size": 1}
        )
    ).json()
    assert (
        empty["total"] == 0
        and empty["total_pages"] == 0
        and not empty["has_next"]
        and not empty["has_previous"]
    )
