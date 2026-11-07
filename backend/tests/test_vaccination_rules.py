import unittest
import uuid
from datetime import date, datetime, timezone
from unittest.mock import patch

import app.db.models_registry  # noqa: F401
from app.common.enums import AppliesTo, DoseStatus, DoseType, VaccineStatus
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.rules import (
    annual_anniversary_in_year,
    certificate_completion_label,
    certificate_initial_dose_complete,
    certificate_overdue_doses,
    certificate_vaccine_complete,
    clinical_today,
    due_info_by_dose,
    due_reminders_for_scheme,
    evaluate_scheme,
    vaccine_status_from_certificate_rules,
    validate_application_date,
)
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig, VaccineRule


def _dose_config(
    *,
    dose_number: int,
    label: str,
    is_required: bool = True,
    dose_type: DoseType = DoseType.STANDARD,
) -> VaccineDoseConfig:
    return VaccineDoseConfig(
        id=uuid.uuid4(),
        vaccine_id=uuid.uuid4(),
        dose_number=dose_number,
        label=label,
        is_required=is_required,
        applies_to=AppliesTo.ALL,
        dose_type=dose_type,
    )


def _dose(
    *,
    dose_number: int,
    config: VaccineDoseConfig,
    status: DoseStatus = DoseStatus.PENDING,
    applied_date: date | None = None,
) -> StudentVaccineDose:
    return StudentVaccineDose(
        id=uuid.uuid4(),
        student_vaccine_id=uuid.uuid4(),
        dose_config_id=config.id,
        dose_number=dose_number,
        dose_config=config,
        status=status,
        applied_date=applied_date,
    )


def _student_vaccine(
    *,
    code: str = "HEP_B",
    has_titer: bool = True,
    doses: list[StudentVaccineDose],
) -> StudentVaccine:
    vaccine = Vaccine(
        id=uuid.uuid4(),
        name="Hepatitis B",
        code=code,
        base_doses=3,
        has_booster=False,
        has_titer=has_titer,
        has_titer_value=False,
        is_annual=False,
        applies_to=AppliesTo.ALL,
        is_active=True,
        display_order=1,
    )
    intervals_by_code = {
        "HEP_B": [
            {"from_dose": 1, "to_dose": 2, "months": 1},
            {"from_dose": 2, "to_dose": 3, "months": 6},
        ],
        "HEP_A": [{"from_dose": 1, "to_dose": 2, "months": 6}],
        "VARICELA": [{"from_dose": 1, "to_dose": 2, "months": 1}],
        "TOXOIDE": [
            {"from_dose": 1, "to_dose": 2, "months": 1},
            {"from_dose": 2, "to_dose": 3, "months": 6},
            {"from_dose": 3, "to_dose": 4, "years": 1},
            {"from_dose": 4, "to_dose": 5, "years": 1},
        ],
    }
    if intervals_by_code.get(code):
        vaccine.rules = [
            VaccineRule(
                vaccine_id=vaccine.id,
                rule_type="schedule",
                rule_config={"intervals": intervals_by_code[code], "reminder_window_days": 7},
                description="test fixture",
            )
        ]
    student_vaccine = StudentVaccine(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        vaccine_id=vaccine.id,
        vaccine=vaccine,
        doses=doses,
        status=VaccineStatus.PENDING,
    )
    for dose in doses:
        dose.student_vaccine_id = student_vaccine.id
        dose.student_vaccine = student_vaccine
    return student_vaccine


class VaccinationRulesTests(unittest.TestCase):
    def test_annual_catalog_uses_vaccine_flag_not_dose_type_rule(self) -> None:
        from app.db.seed import _build_vaccine_catalog

        influenza = next(
            vaccine for vaccine in _build_vaccine_catalog() if vaccine["code"] == "INFLUENZA"
        )

        self.assertTrue(influenza["is_annual"])
        self.assertEqual(influenza["dose_configs"][0]["dose_type"], DoseType.STANDARD)
        self.assertNotIn("annual", influenza["rules"][0]["rule_config"])

    def test_up_to_date_and_certifiable_can_be_true_while_incomplete(self) -> None:
        configs = [
            _dose_config(dose_number=1, label="Primera dosis"),
            _dose_config(dose_number=2, label="Segunda dosis"),
        ]
        vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=configs[0],
                    status=DoseStatus.APPROVED,
                    applied_date=date(2026, 9, 1),
                ),
                _dose(dose_number=2, config=configs[1]),
            ]
        )

        result = evaluate_scheme([vaccine], today=date(2026, 9, 15))

        self.assertTrue(result.is_up_to_date)
        self.assertFalse(result.is_complete)
        self.assertTrue(result.is_certifiable)

    def test_corresponding_unapproved_or_overdue_dose_blocks_up_to_date(self) -> None:
        configs = [
            _dose_config(dose_number=1, label="Primera dosis"),
            _dose_config(dose_number=2, label="Segunda dosis"),
        ]
        vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=configs[0],
                    status=DoseStatus.APPROVED,
                    applied_date=date(2026, 1, 1),
                ),
                _dose(dose_number=2, config=configs[1]),
            ]
        )

        result = evaluate_scheme([vaccine], today=date(2026, 2, 2))

        self.assertFalse(result.is_up_to_date)
        self.assertFalse(result.is_certifiable)

    def test_any_denied_dose_blocks_certification_even_when_not_yet_due(self) -> None:
        config = _dose_config(dose_number=1, label="Primera dosis")
        vaccine = _student_vaccine(
            doses=[_dose(dose_number=1, config=config, status=DoseStatus.DENIED)]
        )

        self.assertFalse(evaluate_scheme([vaccine], today=date(2026, 9, 1)).is_certifiable)

    def test_annual_vaccine_expires_on_day_after_calendar_anniversary(self) -> None:
        config = _dose_config(dose_number=1, label="Anual")
        vaccine = _student_vaccine(
            code="ANNUAL_TEST",
            doses=[
                _dose(
                    dose_number=1,
                    config=config,
                    status=DoseStatus.APPROVED,
                    applied_date=date(2025, 9, 27),
                )
            ],
        )
        vaccine.vaccine.is_annual = True
        dose = vaccine.doses[0]

        valid_anniversary = due_info_by_dose(vaccine, today=date(2026, 9, 27))[dose.id]
        first_expired_day = due_info_by_dose(vaccine, today=date(2026, 9, 28))[dose.id]
        self.assertEqual(valid_anniversary.days_until_due, 0)
        self.assertFalse(valid_anniversary.is_overdue)
        self.assertTrue(valid_anniversary.is_due_today)
        self.assertEqual(first_expired_day.days_until_due, -1)
        self.assertTrue(first_expired_day.is_overdue)
        self.assertFalse(first_expired_day.is_due_today)
        self.assertTrue(evaluate_scheme([vaccine], today=date(2026, 9, 27)).is_complete)
        self.assertFalse(evaluate_scheme([vaccine], today=date(2026, 9, 28)).is_complete)
        self.assertFalse(evaluate_scheme([vaccine], today=date(2026, 9, 28)).is_up_to_date)

    def test_annual_vaccine_february_29_expires_on_february_28_in_non_leap_year(self) -> None:
        config = _dose_config(dose_number=1, label="Anual")
        vaccine = _student_vaccine(
            code="ANNUAL_TEST",
            doses=[
                _dose(
                    dose_number=1,
                    config=config,
                    status=DoseStatus.APPROVED,
                    applied_date=date(2028, 2, 29),
                )
            ],
        )
        vaccine.vaccine.is_annual = True
        due_info = due_info_by_dose(vaccine, today=date(2029, 2, 27))[vaccine.doses[0].id]

        self.assertEqual(due_info.due_date, date(2029, 2, 28))
        self.assertEqual(due_info.days_until_due, 1)
        self.assertTrue(
            due_info_by_dose(vaccine, today=date(2029, 2, 28))[vaccine.doses[0].id].is_due_today
        )
        self.assertTrue(
            due_info_by_dose(vaccine, today=date(2029, 3, 1))[vaccine.doses[0].id].is_overdue
        )

    def test_february_29_anniversary_preserves_leap_day_in_leap_year(self) -> None:
        self.assertEqual(
            annual_anniversary_in_year(date(2028, 2, 29), 2032),
            date(2032, 2, 29),
        )

    def test_february_28_anniversary_is_a_valid_calendar_date(self) -> None:
        self.assertEqual(
            annual_anniversary_in_year(date(2027, 2, 28), 2028),
            date(2028, 2, 28),
        )

    def test_annual_application_today_expires_on_calendar_anniversary(self) -> None:
        config = _dose_config(dose_number=1, label="Anual")
        vaccine = _student_vaccine(
            code="ANNUAL_TEST",
            doses=[
                _dose(
                    dose_number=1,
                    config=config,
                    status=DoseStatus.APPROVED,
                    applied_date=date(2026, 9, 27),
                )
            ],
        )
        vaccine.vaccine.is_annual = True
        self.assertEqual(
            due_info_by_dose(vaccine, today=date(2026, 9, 27))[vaccine.doses[0].id].due_date,
            date(2027, 9, 27),
        )

    def test_bogota_calendar_today_does_not_follow_utc_date_boundary(self) -> None:
        class FixedDateTime:
            @staticmethod
            def now(tz):
                utc_instant = datetime(2026, 9, 28, 4, 30, tzinfo=timezone.utc)
                return utc_instant.astimezone(tz)

        with patch("app.modules.vaccination_scheme.rules.datetime", FixedDateTime):
            self.assertEqual(clinical_today(), date(2026, 9, 27))

    def test_calendar_month_interval_handles_month_end_and_leap_calendar_dates(self) -> None:
        first_config = _dose_config(dose_number=1, label="Primera")
        second_config = _dose_config(dose_number=2, label="Segunda")
        vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=first_config,
                    status=DoseStatus.APPROVED,
                    applied_date=date(2024, 1, 31),
                ),
                _dose(dose_number=2, config=second_config),
            ]
        )
        vaccine.vaccine.rules = [
            VaccineRule(
                vaccine_id=vaccine.vaccine.id,
                rule_type="schedule",
                rule_config={"intervals": [{"from_dose": 1, "to_dose": 2, "months": 1}]},
                description="test schedule",
            )
        ]

        due = due_info_by_dose(vaccine, today=date(2024, 2, 28))

        self.assertEqual(due[vaccine.doses[1].id].due_date, date(2024, 2, 29))
        validate_application_date(date(2024, 2, 29), today=date(2024, 2, 29))

    def test_complete_scheme_can_mix_doses_and_valid_titers_across_vaccines(self) -> None:
        dose_config = _dose_config(dose_number=1, label="Primera dosis")
        dose_vaccine = _student_vaccine(
            code="DOSES_ONLY",
            doses=[_dose(dose_number=1, config=dose_config, status=DoseStatus.APPROVED)],
        )
        standard = _dose_config(dose_number=1, label="Dosis")
        titer = _dose_config(
            dose_number=5,
            label="Titulación",
            is_required=False,
            dose_type=DoseType.TITER,
        )
        titer_vaccine = _student_vaccine(
            code="TITER_PATH",
            doses=[
                _dose(dose_number=1, config=standard),
                _dose(dose_number=5, config=titer, status=DoseStatus.APPROVED),
            ],
        )

        result = evaluate_scheme([dose_vaccine, titer_vaccine], today=date(2026, 9, 27))

        self.assertTrue(result.is_up_to_date)
        self.assertTrue(result.is_complete)
        self.assertTrue(result.is_certifiable)

    def test_application_date_rejects_future_but_accepts_old_dates(self) -> None:
        validate_application_date(date(1900, 1, 1), today=date(2026, 9, 27))
        validate_application_date(date(2024, 2, 29), today=date(2026, 9, 27))
        validate_application_date(date(2026, 9, 27), today=date(2026, 9, 27))
        with self.assertRaises(ValueError):
            validate_application_date(date(2026, 9, 28), today=date(2026, 9, 27))

    def test_required_approved_doses_complete_certificate(self) -> None:
        configs = [
            _dose_config(dose_number=1, label="Primera dosis"),
            _dose_config(dose_number=2, label="Segunda dosis"),
        ]
        student_vaccine = _student_vaccine(
            doses=[
                _dose(dose_number=1, config=configs[0], status=DoseStatus.APPROVED),
                _dose(dose_number=2, config=configs[1], status=DoseStatus.APPROVED),
            ]
        )

        self.assertTrue(certificate_vaccine_complete(student_vaccine))
        self.assertEqual(certificate_completion_label(student_vaccine), "Dosis completas")
        self.assertEqual(
            vaccine_status_from_certificate_rules(student_vaccine.doses),
            VaccineStatus.APPROVED,
        )
        self.assertTrue(certificate_initial_dose_complete(student_vaccine))

    def test_approved_titer_completes_when_no_standard_record_exists(self) -> None:
        standard = _dose_config(dose_number=1, label="Primera dosis")
        titer = _dose_config(
            dose_number=5,
            label="Titulacion",
            is_required=False,
            dose_type=DoseType.TITER,
        )
        student_vaccine = _student_vaccine(
            doses=[
                _dose(dose_number=1, config=standard, status=DoseStatus.PENDING),
                _dose(dose_number=5, config=titer, status=DoseStatus.APPROVED),
            ]
        )

        self.assertTrue(certificate_vaccine_complete(student_vaccine))
        self.assertEqual(certificate_completion_label(student_vaccine), "Titulacion aprobada")
        self.assertEqual(
            vaccine_status_from_certificate_rules(student_vaccine.doses),
            VaccineStatus.APPROVED,
        )

    def test_approved_titer_dominates_even_when_standard_doses_were_applied(self) -> None:
        """An approved titer marks the vaccine as APPROVED regardless of standard doses.

        Clinical rationale: a measurable antibody titer demonstrates immunity, so
        additional doses are no longer required even if some were already applied
        (and even if they are pending review or overdue).
        """
        standard = _dose_config(dose_number=1, label="Primera dosis")
        titer = _dose_config(
            dose_number=5,
            label="Titulacion",
            is_required=False,
            dose_type=DoseType.TITER,
        )
        student_vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=standard,
                    status=DoseStatus.PENDING,
                    applied_date=date(2026, 1, 1),
                ),
                _dose(dose_number=5, config=titer, status=DoseStatus.APPROVED),
            ]
        )

        self.assertTrue(certificate_vaccine_complete(student_vaccine))
        self.assertEqual(certificate_completion_label(student_vaccine), "Titulacion aprobada")
        self.assertEqual(
            vaccine_status_from_certificate_rules(student_vaccine.doses),
            VaccineStatus.APPROVED,
        )

    def test_hepatitis_b_due_dates_are_calculated_from_previous_doses(self) -> None:
        configs = [
            _dose_config(dose_number=1, label="Primera dosis"),
            _dose_config(dose_number=2, label="Segunda dosis"),
            _dose_config(dose_number=3, label="Tercera dosis"),
        ]
        second = _dose(dose_number=2, config=configs[1])
        student_vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=configs[0],
                    applied_date=date(2026, 1, 15),
                ),
                second,
                _dose(dose_number=3, config=configs[2]),
            ]
        )

        due = due_info_by_dose(student_vaccine, today=date(2026, 2, 10))

        self.assertEqual(due[second.id].due_date, date(2026, 2, 15))
        self.assertEqual(due[second.id].days_until_due, 5)
        self.assertEqual(due[second.id].dose_label, "Segunda dosis")

    def test_due_reminders_only_include_doses_inside_window(self) -> None:
        configs = [
            _dose_config(dose_number=1, label="Primera dosis"),
            _dose_config(dose_number=2, label="Segunda dosis"),
        ]
        student_vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=configs[0],
                    applied_date=date(2026, 1, 15),
                ),
                _dose(dose_number=2, config=configs[1]),
            ]
        )

        reminders = due_reminders_for_scheme(
            student_vaccine,
            today=date(2026, 2, 10),
            window_days=7,
        )

        self.assertEqual(len(reminders), 1)
        self.assertEqual(reminders[0].days_until_due, 5)

    def test_certificate_overdue_doses_blocks_after_due_date(self) -> None:
        configs = [
            _dose_config(dose_number=1, label="Primera dosis"),
            _dose_config(dose_number=2, label="Segunda dosis"),
        ]
        student_vaccine = _student_vaccine(
            doses=[
                _dose(
                    dose_number=1,
                    config=configs[0],
                    status=DoseStatus.APPROVED,
                    applied_date=date(2026, 1, 15),
                ),
                _dose(dose_number=2, config=configs[1]),
            ]
        )

        overdue = certificate_overdue_doses(student_vaccine, today=date(2026, 2, 16))

        self.assertEqual(len(overdue), 1)
        self.assertEqual(overdue[0].due_date, date(2026, 2, 15))

    def test_approved_titer_does_not_complete_when_vaccine_has_no_titer_flag(self) -> None:
        """A vaccine without ``has_titer`` cannot be certified via titer.

        Defensive check: even if a titer-typed dose exists on a vaccine that
        doesn't allow titration, the standard-dose path must still be enforced.
        """
        standard = _dose_config(dose_number=1, label="Primera dosis")
        titer = _dose_config(
            dose_number=5,
            label="Titulacion",
            is_required=False,
            dose_type=DoseType.TITER,
        )
        student_vaccine = _student_vaccine(
            has_titer=False,
            doses=[
                _dose(dose_number=1, config=standard, status=DoseStatus.PENDING),
                _dose(dose_number=5, config=titer, status=DoseStatus.APPROVED),
            ],
        )

        self.assertFalse(certificate_vaccine_complete(student_vaccine))
        self.assertIsNone(certificate_completion_label(student_vaccine))
        self.assertEqual(
            vaccine_status_from_certificate_rules(student_vaccine.doses),
            VaccineStatus.PENDING,
        )

    def test_denied_titer_falls_back_to_standard_doses_path(self) -> None:
        """When the titer is not approved, the doses path must still drive status.

        With all required standard doses APPROVED and the titer DENIED, the
        vaccine should be approved via the doses path.
        """
        standard1 = _dose_config(dose_number=1, label="Primera dosis")
        standard2 = _dose_config(dose_number=2, label="Segunda dosis")
        titer = _dose_config(
            dose_number=5,
            label="Titulacion",
            is_required=False,
            dose_type=DoseType.TITER,
        )
        student_vaccine = _student_vaccine(
            doses=[
                _dose(dose_number=1, config=standard1, status=DoseStatus.APPROVED),
                _dose(dose_number=2, config=standard2, status=DoseStatus.APPROVED),
                _dose(dose_number=5, config=titer, status=DoseStatus.DENIED),
            ],
        )

        self.assertTrue(certificate_vaccine_complete(student_vaccine))
        self.assertEqual(certificate_completion_label(student_vaccine), "Dosis completas")
        self.assertEqual(
            vaccine_status_from_certificate_rules(student_vaccine.doses),
            VaccineStatus.APPROVED,
        )

    def test_pending_titer_does_not_block_approval_via_doses(self) -> None:
        """A pending titer must not downgrade a vaccine that is already complete via doses."""
        standard1 = _dose_config(dose_number=1, label="Primera dosis")
        standard2 = _dose_config(dose_number=2, label="Segunda dosis")
        titer = _dose_config(
            dose_number=5,
            label="Titulacion",
            is_required=False,
            dose_type=DoseType.TITER,
        )
        student_vaccine = _student_vaccine(
            doses=[
                _dose(dose_number=1, config=standard1, status=DoseStatus.APPROVED),
                _dose(dose_number=2, config=standard2, status=DoseStatus.APPROVED),
                _dose(dose_number=5, config=titer, status=DoseStatus.PENDING),
            ],
        )

        self.assertTrue(certificate_vaccine_complete(student_vaccine))
        self.assertEqual(certificate_completion_label(student_vaccine), "Dosis completas")
        self.assertEqual(
            vaccine_status_from_certificate_rules(student_vaccine.doses),
            VaccineStatus.APPROVED,
        )


if __name__ == "__main__":
    unittest.main()
