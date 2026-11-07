"""Regression tests for scope, approved records and bootstrap credentials."""

from datetime import date, datetime, timezone

import pytest
from app.common.enums import DoseStatus, Role
from app.core.config import settings
from app.core.exceptions import ConflictException, ForbiddenException
from app.core.security import hash_password, verify_password
from app.db.seed import seed_admin_user
from app.modules.admin.schemas import VaccineCreateRequest, VaccineDoseConfigInput
from app.modules.admin.vaccines.service import VaccineCatalogService
from app.modules.audit.service import AuditService
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import ProfileUpdateRequest
from app.modules.users.service import UserService
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.schemas import ReviewDoseRequest, UpdateDoseRequest
from app.modules.vaccination_scheme.service import SchemeService


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value", [("program", "Medicina"), ("campus", "Bogotá"), ("campus", None)]
)
async def test_admin_cannot_change_own_scope(db, admin_user, field, value):
    await db.refresh(admin_user, ["profile"])
    admin_user.role = Role.ADMIN
    admin_user.profile.program = "Original"
    admin_user.profile.campus = "Original"
    await db.commit()
    with pytest.raises(ForbiddenException):
        await UserService(UserRepository(db)).update_own_profile(
            admin_user, ProfileUpdateRequest(**{field: value, "phone": "123"})
        )
    await db.refresh(admin_user.profile)
    assert getattr(admin_user.profile, field) == "Original"
    assert admin_user.profile.phone is None


@pytest.mark.asyncio
async def test_admin_can_update_contact_with_unchanged_scope(db, admin_user):
    await db.refresh(admin_user, ["profile"])
    admin_user.role = Role.ADMIN
    admin_user.profile.program = "Medicina"
    await db.commit()
    await UserService(UserRepository(db)).update_own_profile(
        admin_user, ProfileUpdateRequest(program="Medicina", phone="123")
    )
    assert admin_user.profile.phone == "123"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload", [{"applied_date": None}, {"applied_date": "2025-02-02"}, {"titer_value": "20"}]
)
async def test_approved_dose_requires_explicit_review_transition(
    db, admin_user, student_user, payload
):
    service = SchemeService(SchemeRepository(db), VaccineRepository(db))
    await VaccineCatalogService(db, service, AuditService(db)).create_vaccine(
        admin_user,
        VaccineCreateRequest(
            name="Synthetic",
            code="SYN",
            dose_configs=[VaccineDoseConfigInput(dose_number=1, label="First")],
        ),
    )
    vaccine = (await service.get_student_scheme(student_user.id))[0]
    dose = vaccine.doses[0]
    dose.applied_date = date(2025, 1, 1)
    dose.status = DoseStatus.APPROVED
    dose.reviewed_by = admin_user.id
    dose.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(dose)
    reviewed_at = dose.reviewed_at
    with pytest.raises(ConflictException):
        await service.update_dose(dose.id, student_user.id, UpdateDoseRequest(**payload))
    assert dose.applied_date == date(2025, 1, 1)
    assert dose.titer_value is None
    assert dose.reviewed_at == reviewed_at
    await service.review_dose(
        dose.id, admin_user.id, ReviewDoseRequest(status=DoseStatus.IN_REVIEW)
    )
    await service.update_dose(dose.id, student_user.id, UpdateDoseRequest(**payload))
    assert dose.status == DoseStatus.IN_REVIEW


@pytest.mark.asyncio
async def test_seed_never_replaces_existing_password(db, admin_user, monkeypatch):
    original_hash = hash_password("ChangedByUser123!")
    admin_user.hashed_password = original_hash
    await db.commit()
    monkeypatch.setattr(settings, "ADMIN_EMAIL", admin_user.email)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "BootstrapOnly123!")
    await seed_admin_user(db)
    await db.refresh(admin_user)
    assert admin_user.hashed_password == original_hash
    assert verify_password("ChangedByUser123!", admin_user.hashed_password)


@pytest.mark.asyncio
async def test_seed_creates_initial_admin_once(db, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "bootstrap@example.invalid")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "BootstrapOnly123!")
    await seed_admin_user(db)
    user = await UserRepository(db).get_by_email(settings.ADMIN_EMAIL)
    assert user.role == Role.APP_ADMIN
    assert verify_password("BootstrapOnly123!", user.hashed_password)
    original_id, original_hash = user.id, user.hashed_password
    await seed_admin_user(db)
    await db.refresh(user)
    assert (user.id, user.hashed_password) == (original_id, original_hash)
