"""Vaccine catalog seed data — the 8 required vaccines with all dose configs and rules."""

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import AppliesTo, DoseType, Gender, Role
from app.core.config import settings
from app.core.security import hash_password
from app.modules.users.models import Profile, User
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig, VaccineRule

logger = logging.getLogger(__name__)


async def seed_vaccines(db: AsyncSession) -> None:
    """Insert the initial vaccine catalog if it doesn't exist yet."""
    result = await db.execute(select(Vaccine).limit(1))
    if result.scalar_one_or_none() is not None:
        await sync_vaccine_schedule_rules(db)
        return  # Already seeded

    vaccines_data = _build_vaccine_catalog()

    for vdata in vaccines_data:
        dose_configs = vdata.pop("dose_configs", [])
        rules = vdata.pop("rules", [])

        vaccine = Vaccine(**vdata)
        db.add(vaccine)
        await db.flush()  # Get vaccine.id

        for dc in dose_configs:
            dc["vaccine_id"] = vaccine.id
            db.add(VaccineDoseConfig(**dc))

        for rule in rules:
            rule["vaccine_id"] = vaccine.id
            db.add(VaccineRule(**rule))

    await db.commit()
    logger.info("Vaccine catalog seeded successfully.")


async def sync_vaccine_schedule_rules(db: AsyncSession) -> None:
    """Synchronize schedule rules for existing vaccine catalogs."""
    catalog = _build_vaccine_catalog()
    changed = False
    for vdata in catalog:
        schedule_rules = [
            rule for rule in vdata.get("rules", []) if rule["rule_type"] == "schedule"
        ]
        if not schedule_rules:
            continue
        result = await db.execute(select(Vaccine).where(Vaccine.code == vdata["code"]))
        vaccine = result.scalar_one_or_none()
        if vaccine is None:
            continue
        await db.execute(
            delete(VaccineRule).where(
                VaccineRule.vaccine_id == vaccine.id,
                VaccineRule.rule_type == "schedule",
            )
        )
        for rule in schedule_rules:
            db.add(
                VaccineRule(
                    vaccine_id=vaccine.id,
                    rule_type=rule["rule_type"],
                    rule_config=rule["rule_config"],
                    description=rule.get("description"),
                )
            )
        changed = True
    if changed:
        await db.commit()


async def seed_admin_user(db: AsyncSession) -> None:
    """Create or synchronize the configured application administrator account."""
    admin_email = settings.ADMIN_EMAIL.strip().lower()
    result = await db.execute(select(User).where(User.email == admin_email).limit(1))
    admin = result.scalar_one_or_none()

    if admin is not None:
        changed = False
        if admin.role != Role.APP_ADMIN:
            admin.role = Role.APP_ADMIN
            changed = True
        if admin.email != admin_email:
            admin.email = admin_email
            changed = True
        if settings.ADMIN_PASSWORD:
            admin.hashed_password = hash_password(settings.ADMIN_PASSWORD)
            changed = True
        if admin.profile:
            if admin.profile.first_name != settings.ADMIN_FIRST_NAME:
                admin.profile.first_name = settings.ADMIN_FIRST_NAME
                changed = True
            if admin.profile.last_name != settings.ADMIN_LAST_NAME:
                admin.profile.last_name = settings.ADMIN_LAST_NAME
                changed = True
        if changed:
            await db.commit()
            logger.info("Admin user synchronized: %s", admin.email)
        return

    if not settings.ADMIN_PASSWORD:
        raise RuntimeError(
            "ADMIN_PASSWORD must be configured before creating the initial app admin."
        )

    admin = User(
        email=admin_email,
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        role=Role.APP_ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.flush()

    profile = Profile(
        user_id=admin.id,
        first_name=settings.ADMIN_FIRST_NAME,
        last_name=settings.ADMIN_LAST_NAME,
        sex=Gender.MALE,
    )
    db.add(profile)
    await db.commit()
    logger.info("Admin user created: %s", admin.email)


def _build_vaccine_catalog() -> list[dict]:
    """Build the full vaccine catalog data structure."""
    return [
        # ─── 1. HEPATITIS B ──────────────────────────────────────────
        {
            "name": "Hepatitis B",
            "code": "HEP_B",
            "base_doses": 3,
            "has_booster": True,
            "has_titer": True,
            "has_titer_value": True,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 1,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Primera dosis de Hepatitis B",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 2,
                    "label": "Segunda dosis de Hepatitis B",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 3,
                    "label": "Tercera dosis de Hepatitis B",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 4,
                    "label": "Refuerzo de Hepatitis B",
                    "is_required": False,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.BOOSTER,
                },
                {
                    "dose_number": 5,
                    "label": "Titulación de Hepatitis B",
                    "is_required": False,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.TITER,
                },
            ],
            "rules": [
                _schedule_rule(
                    "Hepatitis B: segunda dosis al mes de la primera y tercera dosis 6 meses despues de la segunda.",
                    [
                        {"from_dose": 1, "to_dose": 2, "months": 1},
                        {"from_dose": 2, "to_dose": 3, "months": 6},
                    ],
                ),
            ],
        },
        # ─── 2. VARICELA ─────────────────────────────────────────────
        {
            "name": "Varicela",
            "code": "VARICELA",
            "base_doses": 2,
            "has_booster": False,
            "has_titer": True,
            "has_titer_value": False,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 2,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Primera dosis de Varicela",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 2,
                    "label": "Segunda dosis de Varicela",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 3,
                    "label": "Titulación de Varicela",
                    "is_required": False,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.TITER,
                },
            ],
            "rules": [
                _schedule_rule(
                    "Varicela: segunda dosis al mes de la primera.",
                    [{"from_dose": 1, "to_dose": 2, "months": 1}],
                ),
                {
                    "rule_type": "titer_required_if_no_vaccine",
                    "rule_config": {
                        "condition": "no_standard_doses_with_date",
                        "action": "require_titer",
                        "titer_dose_number": 3,
                    },
                    "description": "Si el estudiante no tiene registro de vacuna de Varicela, debe existir titulación.",
                },
            ],
        },
        # ─── 3. HEPATITIS A ──────────────────────────────────────────
        {
            "name": "Hepatitis A",
            "code": "HEP_A",
            "base_doses": 2,
            "has_booster": False,
            "has_titer": False,
            "has_titer_value": False,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 3,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Primera dosis de Hepatitis A",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 2,
                    "label": "Segunda dosis de Hepatitis A",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
            ],
            "rules": [
                _schedule_rule(
                    "Hepatitis A: segunda dosis 6 meses despues de la primera.",
                    [{"from_dose": 1, "to_dose": 2, "months": 6}],
                ),
            ],
        },
        # ─── 4. INFLUENZA ────────────────────────────────────────────
        {
            "name": "Influenza",
            "code": "INFLUENZA",
            "base_doses": 1,
            "has_booster": False,
            "has_titer": False,
            "has_titer_value": False,
            "is_annual": True,
            "applies_to": AppliesTo.ALL,
            "display_order": 4,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Dosis anual de Influenza",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
            ],
            "rules": [
                {
                    "rule_type": "schedule",
                    "rule_config": {
                        "annual": True,
                        "dose_number": 1,
                        "reminder_window_days": 7,
                    },
                    "description": "Influenza: aplicacion anual con recordatorio diario desde 7 dias antes.",
                },
            ],
        },
        # ─── 5. TOXOIDE TETÁNICO ─────────────────────────────────────
        {
            "name": "Toxoide Tetánico",
            "code": "TOXOIDE",
            "base_doses": 3,
            "has_booster": False,
            "has_titer": False,
            "has_titer_value": False,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 5,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Primera dosis de Toxoide Tetánico",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 2,
                    "label": "Segunda dosis de Toxoide Tetánico",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 3,
                    "label": "Tercera dosis de Toxoide Tetánico",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 4,
                    "label": "Cuarta dosis de Toxoide Tetánico",
                    "is_required": True,
                    "applies_to": AppliesTo.FEMALE,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 5,
                    "label": "Quinta dosis de Toxoide Tetánico",
                    "is_required": True,
                    "applies_to": AppliesTo.FEMALE,
                    "dose_type": DoseType.STANDARD,
                },
            ],
            "rules": [
                _schedule_rule(
                    "Toxoide tetanico: segunda dosis al mes, tercera 6 meses despues, cuarta y quinta anuales solo mujeres.",
                    [
                        {"from_dose": 1, "to_dose": 2, "months": 1},
                        {"from_dose": 2, "to_dose": 3, "months": 6},
                        {"from_dose": 3, "to_dose": 4, "years": 1, "applies_to": "female"},
                        {"from_dose": 4, "to_dose": 5, "years": 1, "applies_to": "female"},
                    ],
                ),
            ],
        },
        # ─── 6. TRIPLE VIRAL ─────────────────────────────────────────
        {
            "name": "Triple Viral",
            "code": "TRIPLE_VIRAL",
            "base_doses": 1,
            "has_booster": False,
            "has_titer": False,
            "has_titer_value": False,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 6,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Dosis de Triple Viral",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
            ],
            "rules": [],
        },
        # ─── 7. DPT ──────────────────────────────────────────────────
        {
            "name": "DPT",
            "code": "DPT",
            "base_doses": 1,
            "has_booster": False,
            "has_titer": False,
            "has_titer_value": False,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 7,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Dosis de DPT",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
            ],
            "rules": [],
        },
        # ─── 8. COVID-19 ─────────────────────────────────────────────
        {
            "name": "COVID-19",
            "code": "COVID_19",
            "base_doses": 3,
            "has_booster": False,
            "has_titer": False,
            "has_titer_value": False,
            "is_annual": False,
            "applies_to": AppliesTo.ALL,
            "display_order": 8,
            "dose_configs": [
                {
                    "dose_number": 1,
                    "label": "Primera dosis de COVID-19",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 2,
                    "label": "Segunda dosis de COVID-19",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
                {
                    "dose_number": 3,
                    "label": "Tercera dosis de COVID-19",
                    "is_required": True,
                    "applies_to": AppliesTo.ALL,
                    "dose_type": DoseType.STANDARD,
                },
            ],
            "rules": [],
        },
    ]


def _schedule_rule(description: str, intervals: list[dict]) -> dict:
    return {
        "rule_type": "schedule",
        "rule_config": {
            "intervals": intervals,
            "reminder_window_days": 7,
        },
        "description": description,
    }
