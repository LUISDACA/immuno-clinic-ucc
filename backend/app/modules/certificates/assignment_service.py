"""Explicit, audited configuration of responsible certificate signers."""

import hashlib
import uuid

from app.common.access import is_app_admin
from app.common.enums import Role
from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.modules.audit.service import AuditService
from app.modules.certificates.models import (
    CertificateSignerAssignment,
    CertificateSignerAssignmentConflict,
)
from app.modules.users.models import User
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload


class CertificateSignerAssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def assign(
        self, actor: User, *, program: str, campus: str, admin_id: uuid.UUID
    ) -> CertificateSignerAssignment:
        if not is_app_admin(actor):
            raise ForbiddenException(
                "Solo el administrador de aplicación puede asignar responsables"
            )
        program = program.strip()
        campus = campus.strip()
        if not program or not campus:
            raise ConflictException(
                "Programa y campus son obligatorios para asignar un responsable"
            )

        # Serialize even the initially-empty scope case across API workers. The partial
        # unique index remains the final integrity guard if a lock is bypassed.
        if self.db.bind and self.db.bind.dialect.name == "postgresql":
            digest = hashlib.sha256(f"{program}\0{campus}".encode()).digest()[:8]
            lock_key = int.from_bytes(digest, byteorder="big", signed=True)
            await self.db.execute(select(func.pg_advisory_xact_lock(lock_key)))

        admin = await self.db.scalar(
            select(User)
            .options(joinedload(User.profile))
            .where(User.id == admin_id)
            .with_for_update(of=User)
        )
        if admin is None or admin.role != Role.ADMIN or not admin.is_active:
            raise NotFoundException("Administrador normal")
        profile = admin.profile
        if profile is None or profile.program != program or profile.campus != campus:
            raise ConflictException("El administrador no pertenece al programa y campus indicados")

        current = await self.db.scalar(
            select(CertificateSignerAssignment)
            .where(
                CertificateSignerAssignment.program == program,
                CertificateSignerAssignment.campus == campus,
                CertificateSignerAssignment.active.is_(True),
            )
            .with_for_update()
        )
        if current is not None and current.admin_id == admin.id:
            await self.db.commit()
            return current

        old_admin_id = current.admin_id if current else None
        try:
            if current is not None:
                current.active = False
                await self.db.flush()
            assignment = CertificateSignerAssignment(
                program=program,
                campus=campus,
                admin_id=admin.id,
                assigned_by_id=actor.id,
                active=True,
            )
            self.db.add(assignment)
            await self.db.flush()
            await AuditService(self.db).log(
                actor_id=actor.id,
                action="certificate.signer_assignment.changed",
                target_type="certificate_signer_assignment",
                target_id=assignment.id,
                details={
                    "program": program,
                    "campus": campus,
                    "previous_admin_id": str(old_admin_id) if old_admin_id else None,
                    "admin_id": str(admin.id),
                },
            )
            await self.db.commit()
            return assignment
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictException("Ya existe un responsable activo para este ámbito") from exc
        except Exception:
            await self.db.rollback()
            raise

    async def list_assignments(self) -> list[CertificateSignerAssignment]:
        result = await self.db.execute(
            select(CertificateSignerAssignment).order_by(
                CertificateSignerAssignment.program,
                CertificateSignerAssignment.campus,
                CertificateSignerAssignment.created_at,
            )
        )
        return list(result.scalars().all())

    async def list_conflicts(self) -> list[CertificateSignerAssignmentConflict]:
        result = await self.db.execute(
            select(CertificateSignerAssignmentConflict).order_by(
                CertificateSignerAssignmentConflict.program,
                CertificateSignerAssignmentConflict.campus,
            )
        )
        return list(result.scalars().all())
