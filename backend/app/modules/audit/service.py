"""Audit module — service for logging sensitive actions."""

import uuid
from datetime import date, datetime, timezone
from enum import Enum

from app.common.access import is_app_admin, require_admin_scope
from app.modules.audit.models import AuditLog
from app.modules.users.models import Profile, User
from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload


def audit_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def build_change_details(before: dict, after: dict) -> dict:
    changes = {}
    for key, new_value in after.items():
        old_value = before.get(key)
        if old_value != new_value:
            changes[key] = {
                "old": audit_value(old_value),
                "new": audit_value(new_value),
            }
    return changes


class AuditService:
    """Logs sensitive actions for traceability."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        actor_id: uuid.UUID | None,
        action: str,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def list_all(self, limit: int = 100, offset: int = 0) -> list[AuditLog]:
        result = await self.db.execute(
            select(AuditLog)
            .options(joinedload(AuditLog.actor))
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.unique().scalars().all())

    async def list_for_student(
        self, student_id: uuid.UUID, limit: int = 100, offset: int = 0
    ) -> list[AuditLog]:
        student_id_text = str(student_id)
        result = await self.db.execute(
            select(AuditLog)
            .options(joinedload(AuditLog.actor))
            .where(
                or_(
                    AuditLog.target_id == student_id,
                    AuditLog.details["student_id"].astext == student_id_text,
                    AuditLog.details["target_user_id"].astext == student_id_text,
                )
            )
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.unique().scalars().all())

    async def page_for_user(
        self, user: User, *, administrative: bool, page: int, size: int, include_self: bool = True
    ):
        """Apply the existing visibility predicates before counting/limiting."""
        query = select(AuditLog).options(joinedload(AuditLog.actor))
        if not administrative:
            query = query.where(
                or_(
                    AuditLog.target_id == user.id,
                    AuditLog.details["student_id"].as_string() == str(user.id),
                    AuditLog.details["target_user_id"].as_string() == str(user.id),
                )
            )
            if not include_self:
                query = query.where(or_(AuditLog.actor_id != user.id, AuditLog.actor_id.is_(None)))
        else:
            query = query.where(
                or_(~AuditLog.action.startswith("password."), AuditLog.actor_id == user.id)
            )
            if not is_app_admin(user):
                program, campus = require_admin_scope(user)
                reference = func.coalesce(
                    AuditLog.details["student_id"].as_string(),
                    AuditLog.details["target_user_id"].as_string(),
                    case((AuditLog.target_type == "user", cast(AuditLog.target_id, String))),
                )
                scoped = (
                    select(Profile.user_id)
                    .where(
                        func.replace(cast(Profile.user_id, String), "-", "")
                        == func.replace(reference, "-", ""),
                        Profile.program == program,
                        Profile.campus == campus,
                    )
                    .exists()
                )
                query = query.where(or_(AuditLog.actor_id == user.id, scoped))
        total = (
            await self.db.execute(select(func.count()).select_from(query.subquery()))
        ).scalar_one()
        rows = await self.db.execute(
            query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        return list(rows.unique().scalars()), total
