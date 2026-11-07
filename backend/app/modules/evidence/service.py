"""Evidence module — service."""

import uuid
from datetime import datetime, timezone

from app.common.access import ensure_student_in_admin_scope, is_app_admin
from app.common.enums import AuditAction, DoseStatus, EvidenceBatchStatus, Role
from app.core.cache import invalidate_student_scheme
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.core.file_validators import validate_pdf_file
from app.modules.audit.service import AuditService
from app.modules.evidence.models import EvidenceBatch, EvidenceFile
from app.modules.evidence.repository import EvidenceRepository
from app.modules.evidence.schemas import EvidenceReviewRequest
from app.modules.users.models import User
from app.storage.base import StorageService
from fastapi import UploadFile


class EvidenceService:
    """Evidence upload and management business logic."""

    def __init__(self, repo: EvidenceRepository, storage: StorageService):
        self.repo = repo
        self.storage = storage
        self.audit = AuditService(repo.db)

    async def upload_evidence(
        self,
        user_id: uuid.UUID,
        files: list[UploadFile],
        notes: str | None = None,
        *,
        dose_id: uuid.UUID | None = None,
    ) -> EvidenceBatch:
        """Upload one or more PDFs as a general evidence batch."""
        if not files:
            raise BadRequestException("Debe subir al menos un archivo PDF")

        if dose_id is not None and await self.repo.get_owned_dose(user_id, dose_id) is None:
            raise NotFoundException("Dose", str(dose_id))

        batch = EvidenceBatch(
            user_id=user_id,
            status=EvidenceBatchStatus.IN_REVIEW,
            notes=notes,
            dose_id=dose_id,
        )
        batch = await self.repo.create_batch(batch)

        uploaded_files = []
        for upload_file in files:
            file_data = await validate_pdf_file(upload_file)

            # Store file
            stored_path = await self.storage.upload(
                file_data,
                upload_file.filename or "document.pdf",
                upload_file.content_type,
            )

            evidence_file = EvidenceFile(
                batch_id=batch.id,
                original_filename=upload_file.filename or "document.pdf",
                stored_path=stored_path,
                file_size=len(file_data),
                mime_type=upload_file.content_type or "application/pdf",
                uploaded_at=datetime.now(timezone.utc),
            )
            await self.repo.add_file(evidence_file)
            uploaded_files.append(upload_file.filename or "document.pdf")

        await self.audit.log(
            actor_id=user_id,
            action=AuditAction.EVIDENCE_UPLOADED,
            target_type="evidence_batch",
            target_id=batch.id,
            details={
                "student_id": str(user_id),
                "file_count": len(uploaded_files),
                "files": uploaded_files,
                "notes": notes,
            },
        )
        await self.repo.commit()
        return await self.repo.get_batch_by_id(batch.id)

    async def review_batch(
        self,
        actor: User,
        batch_id: uuid.UUID,
        data: EvidenceReviewRequest,
    ) -> EvidenceBatch:
        batch = await self.repo.get_batch_by_id(batch_id, for_update=True)
        if batch is None:
            raise NotFoundException("Evidence batch", str(batch_id))
        student = batch.user
        if student is None:
            raise NotFoundException("Evidence owner")
        if actor.role == Role.STUDENT:
            raise ForbiddenException()
        if actor.role != Role.APP_ADMIN:
            ensure_student_in_admin_scope(actor, student)

        previous_status = batch.status
        reviewed_at = datetime.now(timezone.utc)
        dose = None
        if data.status.value == EvidenceBatchStatus.APPROVED.value and batch.dose_id is not None:
            dose = await self.repo.get_owned_dose(
                batch.user_id,
                batch.dose_id,
                for_update=True,
            )
            if dose is None:
                raise NotFoundException("Dose", str(batch.dose_id))

        try:
            batch.status = EvidenceBatchStatus(data.status.value)
            batch.reviewed_by = actor.id
            batch.reviewed_at = reviewed_at
            if data.notes is not None:
                batch.notes = data.notes
            if dose is not None:
                dose.status = DoseStatus.APPROVED
                dose.reviewed_by = actor.id
                dose.reviewed_at = reviewed_at
            await self.audit.log(
                actor_id=actor.id,
                action=AuditAction.EVIDENCE_REVIEWED,
                target_type="evidence_batch",
                target_id=batch.id,
                details={
                    "student_id": str(batch.user_id),
                    "old_status": previous_status.value,
                    "new_status": data.status.value,
                    "dose_id": str(batch.dose_id) if dose is not None else None,
                },
            )
            await self.repo.commit()
        except Exception:
            await self.repo.rollback()
            raise

        if dose is not None:
            invalidate_student_scheme(batch.user_id)
        return await self.repo.get_batch_by_id(batch.id)

    async def get_student_batches(
        self,
        user_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[EvidenceBatch]:
        return await self.repo.get_batches_by_user(user_id, limit=limit, offset=offset)

    async def download_file_for_user(
        self,
        actor: User,
        file_id: uuid.UUID,
    ) -> tuple[str, str, bytes]:
        evidence_file = await self.repo.get_file_by_id(file_id)
        if evidence_file is None:
            raise NotFoundException("Evidence file", str(file_id))

        batch = evidence_file.batch
        student = batch.user if batch else None
        if student is None:
            raise NotFoundException("Evidence owner")

        if actor.role == Role.STUDENT:
            if batch.user_id != actor.id:
                raise ForbiddenException("No tienes permiso para descargar esta evidencia")
        elif not is_app_admin(actor):
            ensure_student_in_admin_scope(actor, student)

        try:
            content = await self.storage.download(evidence_file.stored_path)
        except FileNotFoundError as exc:
            raise NotFoundException("Evidence file content", str(file_id)) from exc

        return evidence_file.original_filename, evidence_file.mime_type, content

    async def delete_batch(self, user_id: uuid.UUID, batch_id: uuid.UUID) -> None:
        batch = await self.repo.get_batch_by_id(batch_id)
        if not batch:
            raise BadRequestException("Lote de evidencia no encontrado")

        if batch.user_id != user_id:
            raise BadRequestException("No tienes permiso para eliminar esta evidencia")

        await self._delete_batch_files_and_record(batch)

    async def delete_student_batch(
        self,
        student_id: uuid.UUID,
        batch_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> None:
        batch = await self.repo.get_batch_by_id(batch_id)
        if not batch:
            raise BadRequestException("Lote de evidencia no encontrado")

        if batch.user_id != student_id:
            raise BadRequestException("La evidencia no pertenece al estudiante indicado")

        await self._delete_batch_files_and_record(batch, actor_id=actor_id)

    async def _delete_batch_files_and_record(
        self,
        batch: EvidenceBatch,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        file_names = [file.original_filename for file in batch.files]

        # Delete physical files
        for file in batch.files:
            await self.storage.delete(file.stored_path)

        await self.audit.log(
            actor_id=actor_id or batch.user_id,
            action=AuditAction.EVIDENCE_DELETED,
            target_type="evidence_batch",
            target_id=batch.id,
            details={
                "student_id": str(batch.user_id),
                "file_count": len(file_names),
                "files": file_names,
            },
        )
        await self.repo.delete_batch(batch)
        await self.repo.commit()
