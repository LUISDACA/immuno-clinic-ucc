"""Critical API workflow with real DB, local files, JWT and PDF rendering."""

import asyncio
import hashlib
import io
import os
import re
import uuid
from datetime import date, datetime, timezone
from html import unescape
from urllib.parse import parse_qs, urlparse

import pytest
from app.common.enums import Role
from app.main import app
from app.modules.admin.schemas import VaccineCreateRequest, VaccineDoseConfigInput
from app.modules.admin.vaccines.service import VaccineCatalogService
from app.modules.audit.models import AuditLog
from app.modules.audit.service import AuditService
from app.modules.certificates.models import (
    CertificateEmission,
    CertificateSignature,
    CertificateSignerAssignment,
    CertificateStatus,
)
from app.modules.certificates.service import CertificateService
from app.modules.certificates.signature_service import CertificateSignatureService
from app.modules.users.models import User
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService
from app.storage.base import get_storage_service
from PIL import Image
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker


async def login(client, name, version=1):
    result = await client.post(
        f"/api/v{version}/auth/login",
        json={"email": f"{name}@example.com", "password": "SyntheticOnly123!"},
    )
    assert result.status_code == 200
    return {"Authorization": "Bearer " + result.json()["access_token"]}, result.json()[
        "refresh_token"
    ]


async def catalog(engine, accounts):
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        admin = await db.get(User, accounts["app_admin"])
        scheme = SchemeService(SchemeRepository(db), VaccineRepository(db))
        vaccine = await VaccineCatalogService(db, scheme, AuditService(db)).create_vaccine(
            admin,
            VaccineCreateRequest(
                name="Synthetic vaccine",
                code="SYNTHETIC",
                dose_configs=[VaccineDoseConfigInput(dose_number=1, label="First")],
            ),
        )
        return str(vaccine.id)


@pytest.mark.asyncio
@pytest.mark.parametrize("reviewer", ["admin", "app_admin"])
async def test_login_scheme_evidence_review_certificate(
    integration_client, integration_engine, integration_accounts, reviewer
):
    client = integration_client
    await catalog(integration_engine, integration_accounts)
    student, refresh = await login(client, "student", version=2)
    admin, _ = await login(client, reviewer, version=2)
    app_admin = (
        admin if reviewer == "app_admin" else (await login(client, "app_admin", version=2))[0]
    )
    normal_admin, _ = await login(client, "admin", version=2)
    outsider, _ = await login(client, "outside", version=2)
    other = outsider
    signature_image = io.BytesIO()
    Image.new("RGBA", (80, 30), (15, 35, 65, 255)).save(signature_image, format="PNG")
    signature_upload = await client.post(
        "/api/v1/certificates/signature",
        headers=normal_admin,
        files={"file": ("synthetic-signature.png", signature_image.getvalue(), "image/png")},
    )
    assert signature_upload.status_code == 200
    assert "storage_key" not in signature_upload.json()
    assert (
        await client.post(
            "/api/v1/certificates/signature",
            headers=student,
            files={"file": ("synthetic.png", signature_image.getvalue(), "image/png")},
        )
    ).status_code == 403
    assert (
        await client.get("/api/v1/certificates/signature/active", headers=normal_admin)
    ).status_code == 200
    assert (
        await client.get("/api/v1/certificates/signature/active/image", headers=student)
    ).status_code == 403
    assert (
        await client.get("/api/v1/certificates/signature/active", headers=outsider)
    ).status_code == 404
    assert (
        await client.get("/api/v1/certificates/signature/active/image", headers=outsider)
    ).status_code == 404
    assert (await client.get("/api/v1/certificates/signature/active/image")).status_code == 401
    rotated = await client.post("/api/v2/auth/refresh", json={"refresh_token": refresh})
    assert rotated.status_code == 200
    student = {"Authorization": "Bearer " + rotated.json()["access_token"]}
    forbidden_profile_change = await client.put(
        "/api/v1/users/me/profile",
        headers=student,
        json={"sex": "male"},
    )
    assert forbidden_profile_change.status_code == 403
    own_profile = await client.get("/api/v1/users/me", headers=student)
    assert own_profile.json()["profile"]["sex"] == "female"
    student_search = await client.post(
        "/api/v1/admin/students/search",
        headers=admin,
        json={"search": "student@example.com", "page": 1, "page_size": 20},
    )
    assert student_search.status_code == 200
    recipient_search = await client.post(
        "/api/v1/communications/recipients/search",
        headers=admin,
        json={"target": "students", "search": "student@example.com"},
    )
    assert recipient_search.status_code == 200
    scheme = await client.get("/api/v1/scheme/", headers=student)
    assert scheme.status_code == 200
    dose_id = scheme.json()["vaccines"][0]["doses"][0]["id"]
    other_dose_id = str(uuid.uuid4())
    rejected = await client.get("/api/v1/certificates/scheme", headers=student)
    assert rejected.status_code == 400
    assert rejected.json()["code"] == "CERTIFICATE_NOT_ELIGIBLE"
    assert (
        await client.put(
            f"/api/v1/scheme/doses/{dose_id}",
            headers=student,
            json={"applied_date": date.today().isoformat()},
        )
    ).status_code == 200
    pdf = io.BytesIO()
    canvas = Canvas(pdf)
    canvas.drawString(50, 700, "Synthetic evidence only")
    canvas.save()
    upload = await client.post(
        "/api/v1/evidence/upload",
        headers=student,
        files={"files": ("synthetic.pdf", pdf.getvalue(), "application/pdf")},
        data={"dose_id": dose_id},
    )
    assert upload.status_code == 200
    assert upload.json()["status"] == "in_review"
    assert upload.json()["dose_id"] == dose_id
    foreign_link = await client.post(
        "/api/v1/evidence/upload",
        headers=student,
        files={"files": ("synthetic.pdf", pdf.getvalue(), "application/pdf")},
        data={"dose_id": other_dose_id},
    )
    assert foreign_link.status_code == 404
    evidence_review_path = f"/api/v1/evidence/batches/{upload.json()['id']}/review"
    assert (
        await client.patch(
            evidence_review_path,
            headers=student,
            json={"status": "approved"},
        )
    ).status_code == 403
    scheme_status_before_evidence_decision = await client.get("/api/v1/scheme/", headers=student)
    evidence_decision = await client.patch(
        evidence_review_path,
        headers=admin,
        json={"status": "approved"},
    )
    assert evidence_decision.status_code == 200
    assert evidence_decision.json()["status"] == "approved"
    assert evidence_decision.json()["reviewed_by"]
    updated_scheme = (await client.get("/api/v1/scheme/", headers=student)).json()
    assert updated_scheme["vaccines"][0]["doses"][0]["status"] == "approved"
    assert (await client.get("/api/v1/scheme/", headers=student)).json()["vaccines"][0][
        "status"
    ] == scheme_status_before_evidence_decision.json()["vaccines"][0]["status"]
    file_id = upload.json()["files"][0]["id"]
    path = f"/api/v1/evidence/files/{file_id}"
    assert (await client.get(path, headers=student)).content == pdf.getvalue()
    assert (await client.get(path, headers=admin)).status_code == 200
    for forbidden in (other, outsider):
        assert (await client.get(path, headers=forbidden)).status_code == 403
    review_path = f"/api/v1/admin/doses/{dose_id}/review"
    for forbidden in (student, outsider):
        assert (
            await client.put(review_path, headers=forbidden, json={"status": "approved"})
        ).status_code == 403
    assert (
        await client.put(
            review_path,
            headers=admin,
            json={"status": "approved", "admin_notes": "Synthetic reviewed evidence"},
        )
    ).status_code == 200
    assert (
        await client.put(
            f"/api/v1/scheme/doses/{dose_id}", headers=student, json={"applied_date": None}
        )
    ).status_code == 409
    current_scheme = (await client.get("/api/v1/scheme/", headers=student)).json()
    assert current_scheme["approved_vaccines"] == 1, (
        current_scheme["vaccines"][0]["status"],
        current_scheme["vaccines"][0]["doses"][0]["status"],
        current_scheme["is_complete"],
    )
    emitted_pdf = None
    for path, headers in (
        ("/api/v1/certificates/scheme", student),
        (f"/api/v1/admin/students/{integration_accounts['student']}/certificate", admin),
    ):
        certificate = await client.get(path, headers=headers)
        assert certificate.status_code == 200
        assert certificate.headers["content-type"] == "application/pdf"
        assert certificate.content.startswith(b"%PDF-") and len(certificate.content) > 1000
        emitted_pdf = certificate.content

    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        emissions = list(
            (
                await db.execute(
                    select(CertificateEmission)
                    .where(CertificateEmission.user_id == integration_accounts["student"])
                    .order_by(CertificateEmission.issued_at)
                )
            )
            .scalars()
            .all()
        )
    assert len(emissions) == 2
    assert len({row.public_id for row in emissions}) == 2
    assert all(row.signature_id is not None for row in emissions)
    assert emissions[0].signer_admin_id == integration_accounts["admin"]
    assert emissions[0].signer_assignment_id is not None
    assert emissions[1].signer_admin_id == integration_accounts["admin"]
    if reviewer == "app_admin":
        assert emissions[1].signer_assignment_id is not None
    old_emission_ids = [row.id for row in emissions]
    old_signature_ids = [row.signature_id for row in emissions]

    created_responsible = await client.post(
        "/api/v1/admin/admins",
        headers=app_admin,
        json={
            "email": "phase4-replacement@example.com",
            "password": "SyntheticOnly123!",
            "first_name": "Synthetic",
            "last_name": "Replacement",
            "program": "Medicina",
            "campus": "Bogotá",
        },
    )
    assert created_responsible.status_code == 200
    replacement_image = io.BytesIO()
    Image.new("RGBA", (80, 30), (90, 30, 15, 255)).save(replacement_image, format="PNG")
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        replacement_user = await db.get(User, uuid.UUID(created_responsible.json()["id"]))
        uploaded_replacement_signature = await CertificateSignatureService(
            db, app.dependency_overrides[get_storage_service]()
        ).upload(replacement_user, replacement_image.getvalue(), "image/png")
    assignment_update = await client.put(
        "/api/v1/admin/certificate-signer-assignments",
        headers=app_admin,
        json={
            "program": "Medicina",
            "campus": "Bogotá",
            "admin_id": created_responsible.json()["id"],
        },
    )
    assert assignment_update.status_code == 200
    replacement_certificate = await client.get("/api/v1/certificates/scheme", headers=student)
    assert replacement_certificate.status_code == 200
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        updated_emissions = list(
            (
                await db.execute(
                    select(CertificateEmission)
                    .where(CertificateEmission.user_id == integration_accounts["student"])
                    .order_by(CertificateEmission.issued_at)
                )
            )
            .scalars()
            .all()
        )
    assert len(updated_emissions) == 3
    assert [row.id for row in updated_emissions[:2]] == old_emission_ids
    assert [row.signature_id for row in updated_emissions[:2]] == old_signature_ids
    assert str(updated_emissions[2].signer_admin_id) == created_responsible.json()["id"]
    assert updated_emissions[2].signature_id == uploaded_replacement_signature.id
    assert str(updated_emissions[2].signer_assignment_id) == assignment_update.json()["id"]
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        used_signatures = list(
            (
                await db.execute(
                    select(CertificateSignature).where(
                        CertificateSignature.id.in_([row.signature_id for row in emissions])
                    )
                )
            )
            .scalars()
            .all()
        )
    assert len(used_signatures) == 1
    assert used_signatures[0].admin_id == integration_accounts["admin"]
    assert all(re.fullmatch(r"[A-Za-z0-9_-]{43}", row.public_id) for row in updated_emissions)
    selected = emissions[-1]
    assert selected.document_sha256 == hashlib.sha256(emitted_pdf).hexdigest()
    valid = await client.get(f"/verify/{selected.public_id}")
    assert valid.status_code == 200
    assert valid.json()["status"] == "VALID"
    assert valid.json()["integrity"] == "NOT_CHECKED"
    assert "no-store" in valid.headers["cache-control"]
    assert valid.headers["x-robots-tag"] == "noindex, nofollow"
    assert "student@example.com" not in valid.text
    assert "name" not in valid.json()
    assert "signature_id" not in valid.json()
    assert "signature_sha256" not in valid.json()
    assert (await client.get(f"/verify/{selected.public_id}/signature")).status_code == 404
    assert (
        await client.get(
            f"/api/v1/certificates/students/{integration_accounts['student']}", headers=student
        )
    ).status_code == 403
    assert (
        await client.get(
            f"/api/v1/certificates/students/{integration_accounts['student']}", headers=outsider
        )
    ).status_code == 403
    listed = await client.get(
        f"/api/v1/certificates/students/{integration_accounts['student']}", headers=admin
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 3
    matched = await client.get(
        f"/verify/{selected.public_id}?sha256={hashlib.sha256(emitted_pdf).hexdigest()}"
    )
    assert matched.json()["integrity"] == "MATCH"
    tampered_pdf = bytearray(emitted_pdf)
    tampered_pdf[-10] ^= 1
    altered_hash = hashlib.sha256(tampered_pdf).hexdigest()
    altered = await client.get(f"/verify/{selected.public_id}?sha256={altered_hash}")
    assert altered.json()["status"] == "INVALID"
    assert (await client.get(f"/verify/{selected.public_id}?sha256=bad")).json()[
        "status"
    ] == "INVALID"
    assert (await client.get(f"/verify/{'A' * 43}")).json()["status"] == "NOT_FOUND"
    assert (await client.get("/verify/short")).json()["status"] == "INVALID"
    assert (
        await client.post(
            f"/api/v1/certificates/{selected.id}/revoke",
            headers=student,
            json={"reason": "synthetic test"},
        )
    ).status_code == 403
    revoked = await client.post(
        f"/api/v1/certificates/{selected.id}/revoke",
        headers=admin,
        json={"reason": "synthetic test"},
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "REVOKED"
    public_revoked = await client.get(f"/verify/{selected.public_id}")
    assert public_revoked.json()["status"] == "REVOKED"
    assert "synthetic test" not in public_revoked.text
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        revoke_audit = await db.scalar(
            select(AuditLog).where(
                AuditLog.action == "certificate.revoked",
                AuditLog.target_id == selected.id,
            )
        )
        assert revoke_audit is not None
        assert revoke_audit.actor_id == integration_accounts[reviewer]
        assert revoke_audit.details == {}

    changed_profile = await client.put(
        f"/api/v1/admin/students/{integration_accounts['student']}/profile",
        headers=normal_admin,
        json={"sex": "male"},
    )
    assert changed_profile.status_code == 200
    assert changed_profile.json()["profile"]["sex"] == "male"


@pytest.mark.asyncio
async def test_signer_assignment_permissions_and_explicit_reassignment(
    integration_client, integration_engine, integration_accounts
):
    app_admin, _ = await login(integration_client, "app_admin", version=2)
    normal_admin, _ = await login(integration_client, "admin", version=2)
    student, _ = await login(integration_client, "student", version=2)
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        replacement = User(
            email=f"replacement-{integration_accounts['student']}@example.test",
            hashed_password="synthetic-only",
            role=Role.ADMIN,
            is_active=True,
        )
        db.add(replacement)
        await db.flush()
        from app.common.enums import Gender
        from app.modules.users.models import Profile

        db.add(
            Profile(
                user_id=replacement.id,
                first_name="Synthetic",
                last_name="Replacement",
                sex=Gender.MALE,
                program="Medicina",
                campus="Bogotá",
            )
        )
        await db.commit()
        replacement_id = replacement.id

    path = "/api/v1/admin/certificate-signer-assignments"
    payload = {"program": "Medicina", "campus": "Bogotá", "admin_id": str(replacement_id)}
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        await db.execute(
            CertificateSignerAssignment.__table__.update()
            .where(
                CertificateSignerAssignment.program == "Medicina",
                CertificateSignerAssignment.campus == "Bogotá",
                CertificateSignerAssignment.active.is_(True),
            )
            .values(active=False)
        )
        await db.commit()
    missing_assignment = await integration_client.get(
        "/api/v1/certificates/scheme", headers=student
    )
    assert missing_assignment.status_code == 409
    assert missing_assignment.json()["code"] == "CERTIFICATE_SIGNER_NOT_ASSIGNED"
    assert (
        await integration_client.put(path, headers=normal_admin, json=payload)
    ).status_code == 403
    assert (await integration_client.put(path, headers=student, json=payload)).status_code == 403
    configured = await integration_client.put(path, headers=app_admin, json=payload)
    assert configured.status_code == 200
    assert configured.json()["admin_id"] == str(replacement_id)
    rows = await integration_client.get(path, headers=app_admin)
    assert rows.status_code == 200
    active = [row for row in rows.json() if row["active"]]
    assert len(active) == 1 and active[0]["admin_id"] == str(replacement_id)
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        emission = await db.scalar(
            select(CertificateEmission).where(
                CertificateEmission.user_id == integration_accounts["student"]
            )
        )
        assert emission is None


@pytest.mark.skipif(
    not os.environ.get("PHASE1_INTEGRATION_URL"),
    reason="Signer assignment concurrency requires isolated PostgreSQL integration DB",
)
@pytest.mark.asyncio
async def test_concurrent_signer_reassignments_keep_one_active_responsible(
    integration_client, integration_engine, integration_accounts
):
    app_admin, _ = await login(integration_client, "app_admin", version=2)
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        replacement = User(
            email=f"concurrent-{integration_accounts['student']}@example.test",
            hashed_password="synthetic-only",
            role=Role.ADMIN,
            is_active=True,
        )
        db.add(replacement)
        await db.flush()
        from app.common.enums import Gender
        from app.modules.users.models import Profile

        db.add(
            Profile(
                user_id=replacement.id,
                first_name="Synthetic",
                last_name="Concurrent",
                sex=Gender.MALE,
                program="Medicina",
                campus="Bogotá",
            )
        )
        await db.commit()
        replacement_id = replacement.id
    path = "/api/v1/admin/certificate-signer-assignments"
    base = {"program": "Medicina", "campus": "Bogotá"}
    responses = await asyncio.gather(
        integration_client.put(
            path,
            headers=app_admin,
            json={**base, "admin_id": str(integration_accounts["admin"])},
        ),
        integration_client.put(
            path,
            headers=app_admin,
            json={**base, "admin_id": str(replacement_id)},
        ),
    )
    assert all(response.status_code == 200 for response in responses)
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        active = list(
            (
                await db.execute(
                    select(CertificateSignerAssignment).where(
                        CertificateSignerAssignment.program == "Medicina",
                        CertificateSignerAssignment.campus == "Bogotá",
                        CertificateSignerAssignment.active.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )
    assert len(active) == 1


@pytest.mark.skipif(
    not os.environ.get("PHASE1_INTEGRATION_URL"),
    reason="Certificate revocation concurrency requires isolated PostgreSQL integration DB",
)
@pytest.mark.asyncio
async def test_concurrent_certificate_revocations_are_idempotent(
    integration_engine, integration_accounts
):
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        emission = CertificateEmission(
            public_id="B" * 43,
            user_id=integration_accounts["student"],
            issued_at=datetime.now(timezone.utc),
            status=CertificateStatus.ISSUED,
            document_sha256="b" * 64,
            certificate_version=1,
        )
        db.add(emission)
        await db.commit()
        emission_id = emission.id

    async def revoke():
        async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
            return await CertificateService(db).revoke(
                emission_id,
                actor_id=integration_accounts["app_admin"],
                reason="Synthetic concurrent revocation",
            )

    rows = await asyncio.gather(revoke(), revoke())
    assert all(row.status is CertificateStatus.REVOKED for row in rows)
    async with async_sessionmaker(integration_engine, expire_on_commit=False)() as db:
        audit_count = await db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action == "certificate.revoked", AuditLog.target_id == emission_id)
        )
        assert audit_count == 1


@pytest.mark.asyncio
async def test_public_verifier_uses_shared_rate_limit(integration_client):
    client = integration_client
    results = [await client.get(f"/verify/{'C' * 43}") for _ in range(31)]
    assert [response.status_code for response in results[:30]] == [200] * 30
    assert results[-1].status_code == 429
    assert results[-1].headers.get("retry-after")
    assert "no-store" in results[-1].headers["cache-control"]


def reset_token(inbox):
    html = inbox.messages[-1].get_body(preferencelist=("html",)).get_content()
    link = re.search(r'href="([^"]*reset-password[^\"]*)"', html).group(1)
    return parse_qs(urlparse(link).query)["token"][0]


@pytest.mark.asyncio
async def test_concurrent_reset_consumes_token_once(
    integration_client, integration_accounts, smtp_inbox
):
    client = integration_client
    _, refresh = await login(client, "student")
    assert (
        await client.post("/api/v1/auth/forgot-password", json={"email": "student@example.com"})
    ).status_code == 200
    token = reset_token(smtp_inbox)
    results = await asyncio.wait_for(
        asyncio.gather(
            *[
                client.post(
                    "/api/v1/auth/reset-password",
                    json={"token": token, "new_password": "SyntheticChanged123!"},
                )
                for _ in range(2)
            ]
        ),
        10,
    )
    assert sorted(r.status_code for r in results) == [200, 400]
    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    ).status_code == 401


@pytest.mark.asyncio
async def test_refresh_reset_race_revokes_future_refresh(
    integration_client, integration_accounts, smtp_inbox
):
    client = integration_client
    _, refresh = await login(client, "student")
    await client.post("/api/v1/auth/forgot-password", json={"email": "student@example.com"})
    token = reset_token(smtp_inbox)
    results = await asyncio.wait_for(
        asyncio.gather(
            client.post(
                "/api/v1/auth/reset-password",
                json={"token": token, "new_password": "SyntheticChanged123!"},
            ),
            *[
                client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
                for _ in range(5)
            ],
        ),
        10,
    )
    assert results[0].status_code == 200
    assert all(r.status_code in (200, 401) for r in results[1:])
    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "student@example.com", "password": "SyntheticChanged123!"},
        )
    ).status_code == 200


@pytest.mark.asyncio
async def test_concurrent_catalog_updates_do_not_duplicate_doses(
    integration_client, integration_engine, integration_accounts
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("Concurrent catalog reconciliation requires PostgreSQL row locks")
    vaccine_id = await catalog(integration_engine, integration_accounts)
    headers, _ = await login(integration_client, "app_admin")
    payload = {
        "dose_configs": [
            {"dose_number": 1, "label": "First"},
            {"dose_number": 2, "label": "Second"},
        ]
    }
    results = await asyncio.wait_for(
        asyncio.gather(
            *[
                integration_client.put(
                    f"/api/v1/admin/vaccines/{vaccine_id}", headers=headers, json=payload
                )
                for _ in range(2)
            ]
        ),
        10,
    )
    assert [r.status_code for r in results] == [200, 200]
    scheme = await integration_client.get(
        f"/api/v1/admin/students/{integration_accounts['student']}/scheme", headers=headers
    )
    doses = scheme.json()[0]["doses"]
    assert [d["dose_number"] for d in doses] == [1, 2]
    assert len({d["id"] for d in doses}) == 2


@pytest.mark.asyncio
async def test_catalog_edit_waits_for_concurrent_catalog_lock(
    integration_client, integration_engine, integration_accounts
):
    if integration_engine.dialect.name != "postgresql":
        pytest.skip("Row locking requires PostgreSQL")
    vaccine_id = await catalog(integration_engine, integration_accounts)
    headers, _ = await login(integration_client, "app_admin")
    async with integration_engine.connect() as connection:
        transaction = await connection.begin()
        await connection.execute(
            text("SELECT id FROM vaccines WHERE id = :id FOR UPDATE"), {"id": vaccine_id}
        )
        request = asyncio.create_task(
            integration_client.put(
                f"/api/v1/admin/vaccines/{vaccine_id}",
                headers=headers,
                json={"dose_configs": [{"dose_number": 1, "label": "Renamed"}]},
            )
        )
        try:
            with pytest.raises(TimeoutError):
                await asyncio.wait_for(asyncio.shield(request), 0.5)
        finally:
            await transaction.rollback()
            response = await asyncio.wait_for(request, 10)
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_account_email_login_and_forced_password_change(
    integration_client, integration_engine, integration_accounts, smtp_inbox
):
    client = integration_client
    await catalog(integration_engine, integration_accounts)
    admin, _ = await login(client, "admin")
    created = await client.post(
        "/api/v1/admin/students",
        headers=admin,
        json={
            "email": "new@example.com",
            "first_name": "Synthetic",
            "last_name": "New",
            "document_number": "SYNTHETIC-ONLY",
            "sex": "female",
            "program": "Medicina",
            "campus": "Bogotá",
        },
    )
    assert created.status_code == 200
    assert created.json()["must_change_password"] is True
    assert len(smtp_inbox.messages) == 1
    html = smtp_inbox.messages[0].get_body(preferencelist=("html",)).get_content()
    password = unescape(
        re.search(r"Contrasena temporal:</strong>\s*([^<]+)", html).group(1)
    ).strip()
    assert password != "SYNTHETIC-ONLY"
    assert password not in created.text
    tokens = await client.post(
        "/api/v1/auth/login", json={"email": "new@example.com", "password": password}
    )
    assert tokens.status_code == 200
    headers = {"Authorization": "Bearer " + tokens.json()["access_token"]}
    assert (await client.get("/api/v1/scheme/", headers=headers)).status_code == 403
    assert (
        await client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={"current_password": password, "new_password": "SyntheticChanged123!"},
        )
    ).status_code == 200
    assert (await client.get("/api/v1/scheme/", headers=headers)).status_code == 401
