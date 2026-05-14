import unittest
import uuid
from datetime import date

import app.db.models_registry  # noqa: F401
from app.common.enums import AppliesTo, DoseStatus, DoseType, VaccineStatus
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.rules import (
    certificate_completion_label,
    certificate_initial_dose_complete,
    certificate_overdue_doses,
    certificate_vaccine_complete,
    due_info_by_dose,
    due_reminders_for_scheme,
    vaccine_status_from_certificate_rules,
)
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig


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


if __name__ == "__main__":
    unittest.main()
