"""Explicit responsibility assignment is fail-closed and auditable."""

import uuid

import pytest
from app.common.enums import Gender, Role
from app.core.exceptions import CertificateSignerException, ConflictException, ForbiddenException
from app.modules.audit.models import AuditLog
from app.modules.certificates.assignment_service import CertificateSignerAssignmentService
from app.modules.certificates.models import CertificateSignerAssignment
from app.modules.users.models import Profile, User
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError


async def _normal_admin(db, *, program="Medicina", campus="Principal"):
    admin = User(
        email=f"responsible-{uuid.uuid4().hex}@test.invalid",
        hashed_password="synthetic-test-hash",
        role=Role.ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.flush()
    admin.profile = Profile(
        user_id=admin.id,
        first_name="Synthetic",
        last_name="Responsible",
        sex=Gender.MALE,
        program=program,
        campus=campus,
    )
    await db.flush()
    return admin


@pytest.mark.asyncio
async def test_app_admin_assigns_single_scoped_responsible_and_audits(db, admin_user):
    responsible = await _normal_admin(db)
    service = CertificateSignerAssignmentService(db)

    row = await service.assign(
        admin_user,
        program="Medicina",
        campus="Principal",
        admin_id=responsible.id,
    )

    assert row.active is True
    assert row.admin_id == responsible.id
    assert row.assigned_by_id == admin_user.id
    audit = await db.scalar(select(AuditLog).where(AuditLog.target_id == row.id))
    assert audit.actor_id == admin_user.id
    assert audit.details["admin_id"] == str(responsible.id)


@pytest.mark.asyncio
async def test_normal_admin_cannot_configure_responsible(db):
    actor = await _normal_admin(db)
    with pytest.raises(ForbiddenException):
        await CertificateSignerAssignmentService(db).assign(
            actor,
            program="Medicina",
            campus="Principal",
            admin_id=actor.id,
        )


@pytest.mark.asyncio
async def test_assignment_rejects_admin_outside_exact_program_campus(db, admin_user):
    responsible = await _normal_admin(db, campus="Cali")
    with pytest.raises(ConflictException):
        await CertificateSignerAssignmentService(db).assign(
            admin_user,
            program="Medicina",
            campus="Principal",
            admin_id=responsible.id,
        )


@pytest.mark.asyncio
async def test_reassignment_keeps_old_assignment_as_history(db, admin_user):
    first = await _normal_admin(db)
    second = await _normal_admin(db)
    service = CertificateSignerAssignmentService(db)
    old = await service.assign(
        admin_user, program="Medicina", campus="Principal", admin_id=first.id
    )
    new = await service.assign(
        admin_user, program="Medicina", campus="Principal", admin_id=second.id
    )

    await db.refresh(old)
    assert old.active is False
    assert new.active is True and new.admin_id == second.id
    rows = list((await db.execute(select(CertificateSignerAssignment))).scalars().all())
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_database_rejects_two_active_responsibles_for_same_scope(db, admin_user):
    first = await _normal_admin(db)
    second = await _normal_admin(db)
    row = await CertificateSignerAssignmentService(db).assign(
        admin_user, program="Medicina", campus="Principal", admin_id=first.id
    )
    db.add(
        CertificateSignerAssignment(
            program=row.program,
            campus=row.campus,
            admin_id=second.id,
            assigned_by_id=admin_user.id,
            active=True,
        )
    )
    with pytest.raises(IntegrityError):
        await db.commit()
    await db.rollback()


@pytest.mark.asyncio
@pytest.mark.parametrize("missing_field", ["program", "campus"])
async def test_self_service_without_complete_student_scope_fails_closed(
    db, student_user, signed_certificate_service, missing_field
):
    service, _, _ = signed_certificate_service
    loaded_student = await service.user_repo.get_by_id(student_user.id)
    setattr(loaded_student.profile, missing_field, None)

    with pytest.raises(CertificateSignerException) as error:
        await service._resolve_signer(loaded_student, None)

    assert error.value.code == "CERTIFICATE_SIGNER_SCOPE_MISSING"


@pytest.mark.asyncio
async def test_self_service_without_assignment_fails_closed(
    db, student_user, signed_certificate_service
):
    service, _, _ = signed_certificate_service
    loaded_student = await service.user_repo.get_by_id(student_user.id)
    await db.execute(CertificateSignerAssignment.__table__.delete())
    await db.commit()

    with pytest.raises(CertificateSignerException) as error:
        await service._resolve_signer(loaded_student, None)

    assert error.value.code == "CERTIFICATE_SIGNER_NOT_ASSIGNED"
