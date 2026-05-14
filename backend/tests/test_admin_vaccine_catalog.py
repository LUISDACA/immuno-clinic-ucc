"""Integration tests for the admin vaccine catalog CRUD."""

import pytest
import pytest_asyncio
from app.common.enums import AppliesTo, DoseStatus, DoseType
from app.core.exceptions import ConflictException
from app.modules.admin.schemas import (
    VaccineCreateRequest,
    VaccineDoseConfigInput,
    VaccineUpdateRequest,
)
from app.modules.admin.vaccines.service import VaccineCatalogService
from app.modules.audit.models import AuditLog
from app.modules.audit.service import AuditService
from app.modules.users.models import User
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService
from app.modules.vaccines.models import Vaccine
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest_asyncio.fixture
def vaccine_catalog_service(db: AsyncSession) -> VaccineCatalogService:
    scheme_service = SchemeService(SchemeRepository(db), VaccineRepository(db))
    audit = AuditService(db)
    return VaccineCatalogService(db, scheme_service, audit)


def _payload(code: str = "TEST_VAC") -> VaccineCreateRequest:
    return VaccineCreateRequest(
        name="Vacuna de Prueba",
        code=code,
        base_doses=2,
        applies_to=AppliesTo.ALL,
        dose_configs=[
            VaccineDoseConfigInput(
                dose_number=1, label="Primera dosis", dose_type=DoseType.STANDARD
            ),
            VaccineDoseConfigInput(
                dose_number=2, label="Segunda dosis", dose_type=DoseType.STANDARD
            ),
        ],
    )


class TestVaccineCatalog:
    @pytest.mark.asyncio
    async def test_create_vaccine_assigns_to_active_student(
        self,
        db: AsyncSession,
        vaccine_catalog_service: VaccineCatalogService,
        admin_user: User,
        student_user: User,
    ):
        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload())
        assert vaccine.code == "TEST_VAC"
        assert len(vaccine.dose_configs) == 2

        result = await db.execute(
            select(StudentVaccine).where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
            )
        )
        sv = result.scalar_one()
        await db.refresh(sv, ["doses"])
        assert len(sv.doses) == 2

        log = await db.execute(select(AuditLog).where(AuditLog.action == "vaccine.created"))
        entry = log.scalar_one()
        assert entry.details["students_regenerated"] == 1

    @pytest.mark.asyncio
    async def test_duplicate_code_raises_conflict(
        self,
        vaccine_catalog_service: VaccineCatalogService,
        admin_user: User,
    ):
        await vaccine_catalog_service.create_vaccine(admin_user, _payload("DUPE"))
        with pytest.raises(ConflictException):
            await vaccine_catalog_service.create_vaccine(admin_user, _payload("DUPE"))

    @pytest.mark.asyncio
    async def test_deactivate_drops_vaccine_from_active_students(
        self,
        db: AsyncSession,
        vaccine_catalog_service: VaccineCatalogService,
        admin_user: User,
        student_user: User,
    ):
        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload("DROP_ME"))
        await vaccine_catalog_service.deactivate_vaccine(admin_user, vaccine.id)

        result = await db.execute(
            select(StudentVaccine).where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
            )
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_update_preserves_applied_date_by_dose_number(
        self,
        db: AsyncSession,
        vaccine_catalog_service: VaccineCatalogService,
        admin_user: User,
        student_user: User,
    ):
        from datetime import date

        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload("KEEP_DATE"))

        result = await db.execute(
            select(StudentVaccineDose)
            .join(StudentVaccine)
            .where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
                StudentVaccineDose.dose_number == 1,
            )
        )
        dose = result.scalar_one()
        dose.applied_date = date(2026, 1, 15)
        dose.status = DoseStatus.IN_REVIEW
        await db.commit()

        await vaccine_catalog_service.update_vaccine(
            admin_user,
            vaccine.id,
            VaccineUpdateRequest(
                name="Vacuna Renombrada",
                dose_configs=[
                    VaccineDoseConfigInput(dose_number=1, label="Primera dosis (nuevo label)"),
                    VaccineDoseConfigInput(dose_number=2, label="Segunda dosis"),
                    VaccineDoseConfigInput(dose_number=3, label="Tercera dosis"),
                ],
            ),
        )

        result = await db.execute(select(Vaccine).where(Vaccine.id == vaccine.id))
        refreshed = result.scalar_one()
        assert refreshed.name == "Vacuna Renombrada"

        result = await db.execute(
            select(StudentVaccineDose)
            .join(StudentVaccine)
            .where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
                StudentVaccineDose.dose_number == 1,
            )
        )
        dose1 = result.scalar_one()
        assert dose1.applied_date == date(2026, 1, 15)

        result = await db.execute(
            select(StudentVaccineDose)
            .join(StudentVaccine)
            .where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
            )
        )
        all_doses = result.scalars().all()
        assert len(all_doses) == 3
