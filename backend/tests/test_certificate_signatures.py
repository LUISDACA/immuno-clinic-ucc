"""Signature upload validation, ownership and immutable certificate linkage."""

import hashlib
import io
import uuid

import pytest
from app.common.enums import Gender, Role
from app.core.exceptions import BadRequestException, ForbiddenException
from app.modules.audit.models import AuditLog
from app.modules.audit.service import AuditService
from app.modules.certificates.models import CertificateSignature
from app.modules.certificates.signature_service import (
    MAX_BYTES,
    CertificateSignatureService,
    normalize_signature,
)
from app.modules.users.models import Profile, User
from PIL import Image
from sqlalchemy import select


def png(color: tuple[int, int, int, int]) -> bytes:
    image = Image.new("RGBA", (80, 30), color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class MemoryStorage:
    def __init__(self):
        self.files: dict[str, bytes] = {}

    async def upload(self, file_data, filename, content_type):
        key = f"private/{uuid.uuid4().hex}.png"
        self.files[key] = file_data
        return key

    async def get_url(self, _key):
        raise AssertionError("Signature must never receive a public URL")

    async def delete(self, key):
        self.files.pop(key, None)

    async def download(self, key):
        return self.files[key]


async def make_normal_admin(db):
    admin = User(
        email=f"signature-{uuid.uuid4().hex}@test.invalid",
        hashed_password="synthetic-test-hash",
        role=Role.ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.flush()
    db.add(
        Profile(
            user_id=admin.id,
            first_name="Synthetic",
            last_name="Admin",
            sex=Gender.MALE,
            program="Medicina",
            campus="Principal",
        )
    )
    await db.commit()
    return admin


def test_signature_accepts_real_png_and_normalizes_to_png():
    normalized = normalize_signature(png((0, 0, 0, 100)), "image/png")
    with Image.open(io.BytesIO(normalized)) as result:
        assert result.format == "PNG"
        assert result.mode == "RGBA"


@pytest.mark.parametrize(("format_name", "mime"), [("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_signature_accepts_allowed_raster_formats(format_name, mime):
    output = io.BytesIO()
    Image.new("RGB", (24, 12), (20, 40, 60)).save(output, format=format_name)
    normalized = normalize_signature(output.getvalue(), mime)
    with Image.open(io.BytesIO(normalized)) as image:
        assert image.format == "PNG"


@pytest.mark.parametrize(
    ("data", "mime"),
    [(png((0, 0, 0, 255)), "image/jpeg"), (b"not-image", "image/png"), (b"x", "image/svg+xml")],
)
def test_signature_rejects_mismatched_corrupt_and_forbidden_content(data, mime):
    with pytest.raises(BadRequestException):
        normalize_signature(data, mime)


def test_signature_rejects_excessive_upload_bytes():
    with pytest.raises(BadRequestException, match="tamaño"):
        normalize_signature(b"x" * (MAX_BYTES + 1), "image/png")


def test_signature_rejects_excessive_dimensions():
    output = io.BytesIO()
    Image.new("RGB", (4097, 1)).save(output, format="PNG")
    with pytest.raises(BadRequestException, match="dimensiones"):
        normalize_signature(output.getvalue(), "image/png")


@pytest.mark.asyncio
async def test_upload_replacement_keeps_history_and_audits_image_hash(db, admin_user):
    admin = await make_normal_admin(db)
    storage = MemoryStorage()
    service = CertificateSignatureService(db, storage)
    first = await service.upload(admin, png((10, 20, 30, 255)), "image/png")
    first_key = first.storage_key
    second = await service.upload(admin, png((90, 80, 70, 255)), "image/png")

    rows = list(
        (
            await db.execute(
                select(CertificateSignature).where(CertificateSignature.admin_id == admin.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    assert first.is_active is False and second.is_active is True
    assert first.is_revoked is False
    assert first_key in storage.files
    assert hashlib.sha256(storage.files[second.storage_key]).hexdigest() == second.sha256
    audits = list(
        (await db.execute(select(AuditLog).where(AuditLog.target_type == "certificate_signature")))
        .scalars()
        .all()
    )
    assert [entry.action for entry in audits] == ["SIGNATURE_UPLOADED", "SIGNATURE_REPLACED"]
    assert audits[-1].actor_id == admin.id
    assert audits[-1].details == {"sha256": second.sha256}


@pytest.mark.asyncio
async def test_app_admin_cannot_upload_personal_signature(db, admin_user):
    with pytest.raises(ForbiddenException):
        await CertificateSignatureService(db, MemoryStorage()).upload(
            admin_user, png((1, 2, 3, 255)), "image/png"
        )


@pytest.mark.asyncio
async def test_failed_audit_rolls_back_signature_replacement_and_deletes_new_object(
    db, monkeypatch
):
    admin = await make_normal_admin(db)
    admin_id = admin.id
    storage = MemoryStorage()
    service = CertificateSignatureService(db, storage)
    original = await service.upload(admin, png((1, 2, 3, 255)), "image/png")

    async def fail_audit(*_args, **_kwargs):
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(AuditService, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        await service.upload(admin, png((4, 5, 6, 255)), "image/png")

    active = await service.active_for(admin_id)
    versions = list(
        (
            await db.execute(
                select(CertificateSignature).where(CertificateSignature.admin_id == admin_id)
            )
        )
        .scalars()
        .all()
    )
    assert active is not None and active.id == original.id
    assert len(versions) == 1
    assert list(storage.files) == [original.storage_key]
