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
from app.modules.vaccination_scheme.models import (
    StudentSchemeVersion,
    StudentVaccine,
    StudentVaccineDose,
)
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig, VaccineRule
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
    async def test_catalog_changes_append_immutable_scheme_versions(
        self,
        db: AsyncSession,
        vaccine_catalog_service: VaccineCatalogService,
        admin_user: User,
        student_user: User,
    ):
        vaccine = await vaccine_catalog_service.create_vaccine(
            admin_user, _payload("VERSIONED_CATALOG")
        )
        await db.flush()
        original_assignment = await db.scalar(
            select(StudentVaccine).where(
                StudentVaccine.user_id == student_user.id,
                StudentVaccine.vaccine_id == vaccine.id,
            )
        )
        await db.refresh(original_assignment, ["doses"])
        original_dose_id = original_assignment.doses[0].id
        original_assignment.doses[0].status = DoseStatus.APPROVED
        from datetime import date

        original_assignment.doses[0].applied_date = date(2026, 1, 15)
        await db.commit()
        historical_v1 = await db.scalar(
            select(StudentSchemeVersion).where(
                StudentSchemeVersion.user_id == student_user.id,
                StudentSchemeVersion.version_number == 2,
            )
        )
        historical_v1_snapshot = historical_v1.snapshot

        await vaccine_catalog_service.update_vaccine(
            admin_user,
            vaccine.id,
            VaccineUpdateRequest(
                name="Vacuna Versionada",
                dose_configs=[
                    VaccineDoseConfigInput(dose_number=1, label="Etiqueta nueva"),
                    VaccineDoseConfigInput(dose_number=2, label="Segunda dosis"),
                    VaccineDoseConfigInput(dose_number=3, label="Tercera dosis"),
                ],
            ),
        )

        versions = list(
            (
                await db.scalars(
                    select(StudentSchemeVersion)
                    .where(StudentSchemeVersion.user_id == student_user.id)
                    .order_by(StudentSchemeVersion.version_number)
                )
            ).all()
        )
        assert [version.reason for version in versions] == [
            "catalog:create:before",
            "catalog:create:after",
            "catalog:update:before",
            "catalog:update:after",
        ]
        assert versions[1].snapshot == historical_v1_snapshot
        before_update = versions[2].snapshot["vaccines"][0]
        after_update = versions[3].snapshot["vaccines"][0]
        assert before_update["doses"][0]["label"] == "Primera dosis"
        assert before_update["doses"][0]["status"] == DoseStatus.APPROVED.value
        assert before_update["doses"][0]["applied_date"] == "2026-01-15"
        assert after_update["doses"][0]["label"] == "Etiqueta nueva"
        assert len(after_update["doses"]) == 3
        active_config_ids = set(
            (
                await db.scalars(
                    select(VaccineDoseConfig.id).where(
                        VaccineDoseConfig.vaccine_id == vaccine.id,
                        VaccineDoseConfig.is_active.is_(True),
                    )
                )
            ).all()
        )
        assert {dose["config_id"] for dose in after_update["doses"]} == {
            str(config_id) for config_id in active_config_ids
        }
        assert after_update["doses"][0]["status"] == before_update["doses"][0]["status"]
        assert after_update["doses"][0]["applied_date"] == before_update["doses"][0]["applied_date"]

        historical_dose = await db.get(StudentVaccineDose, original_dose_id)
        assert historical_dose is not None
        assert historical_dose.applied_date == date(2026, 1, 15)
        assert historical_dose.status == DoseStatus.APPROVED

    @pytest.mark.asyncio
    async def test_schedule_rule_change_versions_existing_student_schemes(
        self,
        db: AsyncSession,
        vaccine_catalog_service: VaccineCatalogService,
        admin_user: User,
        student_user: User,
        monkeypatch: pytest.MonkeyPatch,
    ):
        from app.db import seed

        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload("RULE_VERSION"))
        old_rule = VaccineRule(
            vaccine_id=vaccine.id,
            rule_type="schedule",
            rule_config={"intervals": [{"from_dose": 1, "to_dose": 2, "months": 1}]},
            description="old schedule",
        )
        db.add(old_rule)
        await db.commit()
        db.expire(vaccine, ["rules"])
        monkeypatch.setattr(
            seed,
            "_build_vaccine_catalog",
            lambda: [
                {
                    "code": "RULE_VERSION",
                    "rules": [
                        {
                            "rule_type": "schedule",
                            "rule_config": {
                                "intervals": [{"from_dose": 1, "to_dose": 2, "months": 2}]
                            },
                            "description": "new schedule",
                        }
                    ],
                }
            ],
        )

        await seed.sync_vaccine_schedule_rules(db)

        versions = list(
            (
                await db.scalars(
                    select(StudentSchemeVersion)
                    .where(StudentSchemeVersion.user_id == student_user.id)
                    .order_by(StudentSchemeVersion.version_number)
                )
            ).all()
        )
        assert [version.reason for version in versions[-2:]] == [
            "catalog:rules:before",
            "catalog:rules:after",
        ]
        before_rules = versions[-2].snapshot["vaccines"][0]["rules"]
        after_rules = versions[-1].snapshot["vaccines"][0]["rules"]
        assert before_rules == [
            {
                "rule_type": "schedule",
                "rule_config": {"intervals": [{"from_dose": 1, "to_dose": 2, "months": 1}]},
                "description": "old schedule",
            }
        ]
        assert after_rules == [
            {
                "rule_type": "schedule",
                "rule_config": {"intervals": [{"from_dose": 1, "to_dose": 2, "months": 2}]},
                "description": "new schedule",
            }
        ]
        await db.refresh(old_rule)
        assert old_rule.is_active is False
        active_rules = list(
            (
                await db.scalars(
                    select(VaccineRule).where(
                        VaccineRule.vaccine_id == vaccine.id,
                        VaccineRule.is_active.is_(True),
                    )
                )
            ).all()
        )
        assert len(active_rules) == 1

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
    async def test_deactivate_archives_vaccine_from_active_students(
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
        assert result.scalar_one().is_active is False

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
        dose.status = DoseStatus.APPROVED
        dose.admin_notes = "Preserve review"
        original_id = dose.id
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
        assert dose1.id == original_id
        assert dose1.status == DoseStatus.APPROVED
        assert dose1.admin_notes == "Preserve review"

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

    @pytest.mark.asyncio
    async def test_archive_and_restore_keep_review_history(
        self, db, vaccine_catalog_service, admin_user, student_user
    ):
        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload("ARCHIVE"))
        assignment = await db.scalar(
            select(StudentVaccine).where(StudentVaccine.vaccine_id == vaccine.id)
        )
        await db.refresh(assignment, ["doses"])
        dose = assignment.doses[1]
        original_id = dose.id
        dose.status = DoseStatus.APPROVED
        dose.reviewed_by = admin_user.id
        dose.admin_notes = "Historic review"
        await db.commit()
        await vaccine_catalog_service.update_vaccine(
            admin_user,
            vaccine.id,
            VaccineUpdateRequest(
                dose_configs=[VaccineDoseConfigInput(dose_number=1, label="First")]
            ),
        )
        await db.refresh(dose)
        assert not dose.is_active
        assert dose.status == DoseStatus.APPROVED
        service = vaccine_catalog_service.scheme_service
        active = await service.get_student_scheme(student_user.id)
        assert [d.dose_number for d in active[0].doses] == [1]
        assert await service.scheme_repo.get_dose_by_id(original_id) is None
        await vaccine_catalog_service.update_vaccine(
            admin_user, vaccine.id, VaccineUpdateRequest(dose_configs=_payload().dose_configs)
        )
        await db.refresh(dose)
        assert dose.is_active
        assert dose.id == original_id
        assert dose.status == DoseStatus.APPROVED
        assert dose.reviewed_by == admin_user.id
        assert dose.admin_notes == "Historic review"
        await vaccine_catalog_service.deactivate_vaccine(admin_user, vaccine.id)
        assert await service.get_student_scheme(student_user.id) == []
        await vaccine_catalog_service.reactivate_vaccine(admin_user, vaccine.id)
        active = await service.get_student_scheme(student_user.id)
        assert active[0].doses[1].id == original_id

    @pytest.mark.asyncio
    async def test_adding_other_vaccine_does_not_reset_existing_review(
        self, db, vaccine_catalog_service, admin_user, student_user
    ):
        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload("ORIGINAL"))
        assignment = await db.scalar(
            select(StudentVaccine).where(StudentVaccine.vaccine_id == vaccine.id)
        )
        await db.refresh(assignment, ["doses"])
        dose = assignment.doses[0]
        dose.status = DoseStatus.APPROVED
        dose.reviewed_by = admin_user.id
        original_id = dose.id
        await db.commit()
        await vaccine_catalog_service.create_vaccine(admin_user, _payload("OTHER"))
        await db.refresh(dose)
        assert dose.id == original_id
        assert dose.status == DoseStatus.APPROVED
        assert dose.reviewed_by == admin_user.id

    @pytest.mark.asyncio
    async def test_cannot_reinterpret_existing_dose_type(
        self, vaccine_catalog_service, admin_user, student_user
    ):
        vaccine = await vaccine_catalog_service.create_vaccine(admin_user, _payload("TYPE"))
        with pytest.raises(ConflictException):
            await vaccine_catalog_service.update_vaccine(
                admin_user,
                vaccine.id,
                VaccineUpdateRequest(
                    dose_configs=[
                        VaccineDoseConfigInput(
                            dose_number=1, label="Titer", dose_type=DoseType.TITER
                        )
                    ]
                ),
            )
