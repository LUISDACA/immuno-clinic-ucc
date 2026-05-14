"""Admin workflows for creating and maintaining student accounts."""

import logging
import uuid

from app.common.access import ensure_student_in_admin_scope, is_app_admin, require_admin_scope
from app.common.enums import AuditAction, Role
from app.core.email import send_account_created_email
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.security import hash_password
from app.modules.admin.schemas import CreateStudentRequest, UpdateStudentProfileRequest
from app.modules.audit.service import AuditService, build_change_details
from app.modules.evidence.models import EvidenceBatch
from app.modules.notifications.service import NotificationService
from app.modules.users.models import Profile, User
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.service import SchemeService
from app.storage.base import StorageService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


class StudentAdminService:
    """Coordinates admin-only student lifecycle operations."""

    def __init__(
        self,
        db: AsyncSession,
        user_repo: UserRepository,
        scheme_service: SchemeService,
        audit: AuditService,
        notifications: NotificationService,
    ):
        self.db = db
        self.user_repo = user_repo
        self.scheme_service = scheme_service
        self.audit = audit
        self.notifications = notifications

    async def create_student(
        self,
        admin: User,
        data: CreateStudentRequest,
    ) -> User:
        data = self._apply_admin_scope_to_student_data(admin, data)
        existing = await self.user_repo.get_by_email(data.email)
        if existing:
            raise ConflictException(f"Ya existe un usuario con el correo {data.email}")
        await self._ensure_unique_student_identifiers(data)

        user = User(
            email=data.email,
            hashed_password=hash_password(data.document_number),
            role=Role.STUDENT,
            is_active=True,
            must_change_password=True,
        )
        user = await self.user_repo.create_user(user)

        profile = Profile(
            user_id=user.id,
            first_name=data.first_name,
            last_name=data.last_name,
            document_number=data.document_number,
            student_id=data.student_id,
            birth_date=data.birth_date,
            sex=data.sex,
            phone=data.phone,
            eps_affiliation=data.eps_affiliation,
            emergency_contact_name=data.emergency_contact_name,
            emergency_contact_phone=data.emergency_contact_phone,
            program=data.program,
            campus=data.campus,
            semester=data.semester,
        )
        await self.user_repo.create_profile(profile)
        await self.scheme_service.assign_vaccines_to_student(
            user.id,
            data.sex,
            commit=False,
        )

        await self.notifications.create_notification(
            user.id,
            "Bienvenido a ImmunoClinic",
            "Tu cuenta ha sido creada. Puedes iniciar sesión y completar tu esquema de vacunación.",
            category="system",
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.STUDENT_CREATED,
            target_type="user",
            target_id=user.id,
            details={
                "email": data.email,
                "sex": data.sex.value,
                "program": data.program,
                "campus": data.campus,
            },
        )

        await self.db.commit()
        await send_account_created_email(
            user.email,
            full_name=f"{data.first_name} {data.last_name}".strip(),
            temporary_password=data.document_number,
        )
        return await self.user_repo.get_by_id(user.id)

    async def deactivate_student(self, admin: User, student_id: uuid.UUID) -> User:
        student = await self.get_student_detail(admin, student_id)
        if not student.is_active:
            raise BadRequestException("El estudiante ya está desactivado")

        student.is_active = False
        await self.notifications.create_notification(
            student.id,
            "Cuenta desactivada",
            "Tu cuenta ha sido desactivada por un administrador.",
            category="system",
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.STUDENT_DEACTIVATED,
            target_type="user",
            target_id=student.id,
        )

        await self.db.commit()
        return student

    async def delete_student(
        self,
        admin: User,
        student_id: uuid.UUID,
        storage: StorageService,
    ) -> None:
        """Permanently delete a student and cascade-remove all related data.

        Captures evidence file paths and an audit snapshot before deletion,
        then removes physical files from storage after the DB commit succeeds.
        """
        student = await self.get_student_detail(admin, student_id)

        evidence_paths = await self._collect_student_evidence_paths(student.id)

        snapshot = {
            "email": student.email,
            "role": student.role.value,
            "student_id_uuid": str(student.id),
        }
        if student.profile:
            snapshot.update(
                {
                    "first_name": student.profile.first_name,
                    "last_name": student.profile.last_name,
                    "document_number": student.profile.document_number,
                    "student_id": student.profile.student_id,
                    "program": student.profile.program,
                    "campus": student.profile.campus,
                }
            )

        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.STUDENT_DELETED,
            target_type="user",
            target_id=student.id,
            details={
                "student_id": str(student.id),
                "snapshot": snapshot,
                "evidence_files_removed": len(evidence_paths),
            },
        )

        await self.db.delete(student)
        await self.db.commit()

        for path in evidence_paths:
            try:
                await storage.delete(path)
            except Exception:
                logger.warning(
                    "Failed to delete evidence file %s after student %s hard delete",
                    path,
                    student_id,
                )

    async def _collect_student_evidence_paths(self, student_id: uuid.UUID) -> list[str]:
        result = await self.db.execute(
            select(EvidenceBatch)
            .where(EvidenceBatch.user_id == student_id)
            .options(selectinload(EvidenceBatch.files))
        )
        paths: list[str] = []
        for batch in result.scalars().all():
            for evidence_file in batch.files:
                paths.append(evidence_file.stored_path)
        return paths

    async def reactivate_student(self, admin: User, student_id: uuid.UUID) -> User:
        student = await self.get_student_detail(admin, student_id)
        if student.is_active:
            raise BadRequestException("El estudiante ya está activo")

        student.is_active = True
        await self.notifications.create_notification(
            student.id,
            "Cuenta reactivada",
            "Tu cuenta ha sido reactivada. Puedes volver a iniciar sesión.",
            category="system",
        )
        await self.audit.log(
            actor_id=admin.id,
            action=AuditAction.STUDENT_REACTIVATED,
            target_type="user",
            target_id=student.id,
        )

        await self.db.commit()
        return student

    async def update_student_profile(
        self,
        admin: User,
        student_id: uuid.UUID,
        data: UpdateStudentProfileRequest,
    ) -> User:
        student = await self.get_student_detail(admin, student_id)
        old_sex = student.profile.sex if student.profile else None
        update_data = data.model_dump(exclude_unset=True)
        if not is_app_admin(admin):
            program, campus = require_admin_scope(admin)
            if "program" in update_data and update_data["program"] != program:
                raise ForbiddenException("No puedes mover estudiantes a otro programa")
            if "campus" in update_data and update_data["campus"] != campus:
                raise ForbiddenException("No puedes mover estudiantes a otro campus")
            update_data["program"] = program
            update_data["campus"] = campus
        await self._ensure_unique_student_identifiers(data, current_user_id=student.id)

        if student.profile and update_data:
            before = {key: getattr(student.profile, key) for key in update_data}
            await self.user_repo.update_profile(student.profile, update_data)
            changes = build_change_details(before, update_data)
            if changes:
                await self.audit.log(
                    actor_id=admin.id,
                    action=AuditAction.PROFILE_UPDATED,
                    target_type="user",
                    target_id=student.id,
                    details={
                        "student_id": str(student.id),
                        "source": "admin",
                        "changes": changes,
                    },
                )

        if data.sex is not None and old_sex is not None and data.sex != old_sex:
            await self.scheme_service.regenerate_scheme_for_sex_change(
                student.id,
                data.sex,
                commit=False,
            )
            await self.notifications.create_notification(
                student.id,
                "Esquema de vacunación actualizado",
                "Tu esquema ha sido regenerado debido a un cambio en tu perfil.",
                category="scheme",
            )
            await self.audit.log(
                actor_id=admin.id,
                action=AuditAction.SEX_CHANGED,
                target_type="user",
                target_id=student.id,
                details={"old_sex": old_sex.value, "new_sex": data.sex.value},
            )

        await self.db.commit()
        return await self.user_repo.get_by_id(student_id)

    async def get_student_detail(self, admin: User, student_id: uuid.UUID) -> User:
        student = await self.user_repo.get_by_id(student_id)
        if student is None or student.role != Role.STUDENT:
            raise NotFoundException("Student", str(student_id))
        ensure_student_in_admin_scope(admin, student)
        return student

    async def ensure_student_access(self, admin: User, student_id: uuid.UUID) -> User:
        return await self.get_student_detail(admin, student_id)

    def _apply_admin_scope_to_student_data(
        self,
        admin: User,
        data: CreateStudentRequest,
    ) -> CreateStudentRequest:
        if is_app_admin(admin):
            return data
        program, campus = require_admin_scope(admin)
        if data.program is not None and data.program != program:
            raise ForbiddenException("No puedes crear estudiantes de otro programa")
        if data.campus is not None and data.campus != campus:
            raise ForbiddenException("No puedes crear estudiantes de otro campus")
        return data.model_copy(update={"program": program, "campus": campus})

    async def _ensure_unique_student_identifiers(
        self,
        data: CreateStudentRequest | UpdateStudentProfileRequest,
        current_user_id: uuid.UUID | None = None,
    ) -> None:
        if data.document_number:
            existing_document = await self.user_repo.get_profile_by_document_number(
                data.document_number
            )
            if existing_document and existing_document.user_id != current_user_id:
                raise ConflictException(
                    f"Ya existe un estudiante con la cédula {data.document_number}"
                )

        if data.student_id:
            existing_student_id = await self.user_repo.get_profile_by_student_id(data.student_id)
            if existing_student_id and existing_student_id.user_id != current_user_id:
                raise ConflictException(
                    f"Ya existe un estudiante con el ID institucional {data.student_id}"
                )
