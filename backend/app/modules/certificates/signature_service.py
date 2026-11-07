"""Private upload and versioning for administrators' visual signatures."""

import hashlib
import io
import uuid
import warnings
from contextlib import suppress

from app.common.enums import AuditAction, Role
from app.core.exceptions import BadRequestException, ForbiddenException
from app.modules.audit.service import AuditService
from app.modules.certificates.models import CertificateSignature
from app.modules.users.models import User
from app.storage.base import StorageService
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

MAX_BYTES = 2 * 1024 * 1024
MAX_DIMENSION = 4096
MAX_PIXELS = 8_000_000
FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}


def normalize_signature(data: bytes, declared_mime: str) -> bytes:
    """Validate the actual image and normalize it to PNG for private storage/PDF."""
    if not data or len(data) > MAX_BYTES:
        raise BadRequestException("La imagen de firma excede el tamaño permitido o está vacía.")
    expected_format = FORMATS.get(declared_mime.lower().split(";")[0].strip())
    if expected_format is None:
        raise BadRequestException("Formato de firma no permitido.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                if probe.format != expected_format:
                    raise BadRequestException("El tipo declarado no coincide con la imagen.")
                width, height = probe.size
                if (
                    width <= 0
                    or height <= 0
                    or width > MAX_DIMENSION
                    or height > MAX_DIMENSION
                    or width * height > MAX_PIXELS
                ):
                    raise BadRequestException(
                        "Las dimensiones de la firma exceden el máximo permitido."
                    )
                probe.verify()
            with Image.open(io.BytesIO(data)) as image:
                image.load()
                normalized = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                output = io.BytesIO()
                normalized.save(output, format="PNG", optimize=True)
                return output.getvalue()
    except BadRequestException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise BadRequestException("La imagen de firma no es válida o está dañada.") from exc


class CertificateSignatureService:
    def __init__(self, db: AsyncSession, storage: StorageService):
        self.db = db
        self.storage = storage

    async def upload(self, admin: User, data: bytes, declared_mime: str) -> CertificateSignature:
        if admin.role != Role.ADMIN or not admin.is_active:
            raise ForbiddenException()
        png_data = normalize_signature(data, declared_mime)
        digest = hashlib.sha256(png_data).hexdigest()

        # Persist the new object first; the DB transaction swaps active versions atomically.
        storage_key = await self.storage.upload(png_data, f"{uuid.uuid4().hex}.png", "image/png")
        try:
            await self.db.execute(select(User.id).where(User.id == admin.id).with_for_update())
            active_rows = await self.db.execute(
                select(CertificateSignature)
                .where(
                    CertificateSignature.admin_id == admin.id,
                    CertificateSignature.is_active.is_(True),
                    CertificateSignature.is_revoked.is_(False),
                )
                .with_for_update()
            )
            previous = list(active_rows.scalars().all())
            for old in previous:
                old.is_active = False
            signature = CertificateSignature(
                admin_id=admin.id,
                storage_key=storage_key,
                sha256=digest,
                is_active=True,
                is_revoked=False,
            )
            self.db.add(signature)
            await self.db.flush()
            await AuditService(self.db).log(
                actor_id=admin.id,
                action=(
                    AuditAction.SIGNATURE_REPLACED.value
                    if previous
                    else AuditAction.SIGNATURE_UPLOADED.value
                ),
                target_type="certificate_signature",
                target_id=signature.id,
                details={"sha256": digest},
            )
            await self.db.commit()
            return signature
        except Exception:
            await self.db.rollback()
            with suppress(Exception):
                await self.storage.delete(storage_key)
            raise

    async def active_for(self, admin_id: uuid.UUID) -> CertificateSignature | None:
        return await self.db.scalar(
            select(CertificateSignature).where(
                CertificateSignature.admin_id == admin_id,
                CertificateSignature.is_active.is_(True),
                CertificateSignature.is_revoked.is_(False),
            )
        )
