"""Audit module API router."""

import uuid

from app.common.access import is_app_admin, student_in_admin_scope
from app.core.dependencies import get_current_active_user, require_role
from app.db.session import get_db
from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import AuditActorResponse, AuditLogResponse
from app.modules.audit.service import AuditService
from app.modules.users.models import User
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/audit", tags=["Audit"])


def _get_audit_service(db: AsyncSession = Depends(get_db)) -> AuditService:
    return AuditService(db)


def _actor_response(user: User | None) -> AuditActorResponse | None:
    if user is None:
        return None

    name = None
    if user.profile:
        name = f"{user.profile.first_name} {user.profile.last_name}".strip()

    return AuditActorResponse(
        id=user.id,
        email=user.email,
        name=name,
        role=user.role.value,
    )


def _audit_response(
    entry: AuditLog, student_lookup: dict[str, User] | None = None
) -> AuditLogResponse:
    details = dict(entry.details or {})
    student_id = details.get("student_id") or details.get("target_user_id")
    if student_id is None and entry.target_type == "user" and entry.target_id is not None:
        student_id = str(entry.target_id)

    student = student_lookup.get(str(student_id)) if student_lookup and student_id else None
    if student is not None:
        details["student_name"] = (
            f"{student.profile.first_name} {student.profile.last_name}".strip()
            if student.profile
            else student.email
        )
        details["student_email"] = student.email

    return AuditLogResponse(
        id=entry.id,
        actor=_actor_response(entry.actor),
        action=entry.action,
        target_type=entry.target_type,
        target_id=entry.target_id,
        details=details or None,
        created_at=entry.created_at,
    )


async def _student_lookup(db: AsyncSession, entries: list[AuditLog]) -> dict[str, User]:
    student_ids = set()
    for entry in entries:
        details = entry.details or {}
        raw_id = details.get("student_id") or details.get("target_user_id")
        if raw_id is None and entry.target_type == "user" and entry.target_id is not None:
            raw_id = str(entry.target_id)
        if raw_id is None:
            continue
        try:
            student_ids.add(uuid.UUID(str(raw_id)))
        except ValueError:
            continue

    if not student_ids:
        return {}

    result = await db.execute(
        select(User).options(joinedload(User.profile)).where(User.id.in_(student_ids))
    )
    return {str(user.id): user for user in result.unique().scalars().all()}


def _entry_student_id(entry: AuditLog) -> str:
    details = entry.details or {}
    raw_id = details.get("student_id") or details.get("target_user_id")
    if raw_id is None and entry.target_type == "user" and entry.target_id is not None:
        raw_id = str(entry.target_id)
    return str(raw_id or "")


@router.get("/me", response_model=list[AuditLogResponse])
async def list_my_audit_history(
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    include_self: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    service: AuditService = Depends(_get_audit_service),
):
    """List history entries that affected the current user."""
    entries = await service.list_for_student(current_user.id, limit=limit, offset=offset)
    if not include_self:
        entries = [entry for entry in entries if entry.actor_id != current_user.id]
    lookup = await _student_lookup(db, entries)
    return [_audit_response(entry, lookup) for entry in entries]


@router.get("/admin", response_model=list[AuditLogResponse])
async def list_all_audit_history(
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_role("admin", "app_admin")),
    db: AsyncSession = Depends(get_db),
    service: AuditService = Depends(_get_audit_service),
):
    """List all audit history entries for administrators."""
    entries = await service.list_all(limit=limit, offset=offset)
    entries = [
        entry
        for entry in entries
        if not entry.action.startswith("password.") or entry.actor_id == admin.id
    ]
    lookup = await _student_lookup(db, entries)
    if not is_app_admin(admin):
        entries = [
            entry
            for entry in entries
            if (
                entry.actor_id == admin.id
                or (
                    (student := lookup.get(_entry_student_id(entry))) is not None
                    and student_in_admin_scope(admin, student)
                )
            )
        ]
    return [_audit_response(entry, lookup) for entry in entries]
