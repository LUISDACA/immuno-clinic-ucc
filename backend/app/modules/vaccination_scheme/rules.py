"""Vaccination schedule rules and due-date calculation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.common.enums import DoseStatus, DoseType, VaccineStatus
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from dateutil.relativedelta import relativedelta


@dataclass(frozen=True)
class DoseDueInfo:
    """Due-date information for a vaccine dose."""

    dose_id: UUID
    dose_number: int
    vaccine_name: str
    dose_label: str
    due_date: date
    days_until_due: int


def due_info_by_dose(
    student_vaccine: StudentVaccine,
    *,
    today: date | None = None,
) -> dict[UUID, DoseDueInfo]:
    """Return calculated due dates keyed by student dose id."""
    today = today or date.today()
    vaccine = student_vaccine.vaccine
    if vaccine is None:
        return {}

    doses = {
        dose.dose_number: dose
        for dose in sorted(student_vaccine.doses, key=lambda item: item.dose_number)
    }
    result: dict[UUID, DoseDueInfo] = {}

    def add_sequence_due(
        *,
        source_number: int,
        target_number: int,
        delta: relativedelta,
    ) -> None:
        source = doses.get(source_number)
        target = doses.get(target_number)
        if source is None or target is None:
            return
        if source.applied_date is None or target.applied_date is not None:
            return
        due_date = source.applied_date + delta
        result[target.id] = _build_due_info(
            student_vaccine,
            target,
            due_date,
            today,
        )

    match vaccine.code:
        case "HEP_B":
            add_sequence_due(source_number=1, target_number=2, delta=relativedelta(months=1))
            add_sequence_due(source_number=2, target_number=3, delta=relativedelta(months=6))
        case "HEP_A":
            add_sequence_due(source_number=1, target_number=2, delta=relativedelta(months=6))
        case "VARICELA":
            add_sequence_due(source_number=1, target_number=2, delta=relativedelta(months=1))
        case "TOXOIDE":
            add_sequence_due(source_number=1, target_number=2, delta=relativedelta(months=1))
            add_sequence_due(source_number=2, target_number=3, delta=relativedelta(months=6))
            add_sequence_due(source_number=3, target_number=4, delta=relativedelta(years=1))
            add_sequence_due(source_number=4, target_number=5, delta=relativedelta(years=1))
        case "INFLUENZA":
            dose = doses.get(1)
            if dose is not None and dose.applied_date is not None:
                due_date = dose.applied_date + relativedelta(years=1)
                result[dose.id] = _build_due_info(
                    student_vaccine,
                    dose,
                    due_date,
                    today,
                )

    return result


def due_reminders_for_scheme(
    student_vaccine: StudentVaccine,
    *,
    today: date | None = None,
    window_days: int = 7,
) -> list[DoseDueInfo]:
    """Return doses that should notify today, from due day to window_days before."""
    reminders = []
    for due_info in due_info_by_dose(student_vaccine, today=today).values():
        if 0 <= due_info.days_until_due <= window_days:
            reminders.append(due_info)
    return reminders


def certificate_vaccine_complete(student_vaccine: StudentVaccine) -> bool:
    """Return whether a vaccine satisfies certificate approval rules."""
    return _certificate_path(student_vaccine) is not None


def certificate_completion_label(student_vaccine: StudentVaccine) -> str | None:
    """Human-readable completion path for certificates."""
    path = _certificate_path(student_vaccine)
    if path == "doses":
        return "Dosis completas"
    if path == "titer":
        return "Titulacion aprobada"
    return None


def certificate_initial_dose_complete(student_vaccine: StudentVaccine) -> bool:
    """Return whether the first required standard dose is approved for certification."""
    first_dose = _first_required_standard_dose(student_vaccine.doses)
    return bool(first_dose is not None and first_dose.status == DoseStatus.APPROVED)


def certificate_overdue_doses(
    student_vaccine: StudentVaccine,
    *,
    today: date | None = None,
) -> list[DoseDueInfo]:
    """Return pending doses whose due date has already passed."""
    return [
        due_info
        for due_info in due_info_by_dose(student_vaccine, today=today).values()
        if due_info.days_until_due < 0
    ]


def vaccine_status_from_certificate_rules(
    doses: list[StudentVaccineDose],
) -> VaccineStatus:
    """Calculate vaccine status, allowing approved titer as a valid alternative."""
    if not doses:
        return VaccineStatus.PENDING

    student_vaccine = doses[0].student_vaccine
    if student_vaccine is not None and certificate_vaccine_complete(student_vaccine):
        return VaccineStatus.APPROVED

    standard_required = _required_standard_doses(doses)
    if not standard_required:
        standard_required = [dose for dose in doses if not _is_titer_dose(dose)] or doses

    titer_doses = _titer_doses(doses)
    no_standard_records = not _has_standard_dose_record(standard_required)
    considered = list(standard_required)
    if no_standard_records and titer_doses:
        considered.extend(titer_doses)

    statuses = [dose.status for dose in considered]
    if any(status == DoseStatus.DENIED for status in statuses):
        return VaccineStatus.DENIED
    if any(status == DoseStatus.IN_REVIEW for status in statuses):
        return VaccineStatus.IN_REVIEW
    return VaccineStatus.PENDING


def _build_due_info(
    student_vaccine: StudentVaccine,
    dose: StudentVaccineDose,
    due_date: date,
    today: date,
) -> DoseDueInfo:
    vaccine_name = student_vaccine.vaccine.name if student_vaccine.vaccine else "Vacuna"
    dose_label = (
        dose.dose_config.label if dose.dose_config is not None else f"Dosis {dose.dose_number}"
    )
    return DoseDueInfo(
        dose_id=dose.id,
        dose_number=dose.dose_number,
        vaccine_name=vaccine_name,
        dose_label=dose_label,
        due_date=due_date,
        days_until_due=(due_date - today).days,
    )


def _certificate_path(student_vaccine: StudentVaccine) -> str | None:
    doses = list(student_vaccine.doses)
    standard_required = _required_standard_doses(doses)
    if standard_required and all(dose.status == DoseStatus.APPROVED for dose in standard_required):
        return "doses"

    vaccine = student_vaccine.vaccine
    if vaccine is None or not vaccine.has_titer:
        return None
    if _has_standard_dose_record(standard_required):
        return None
    titer_doses = _titer_doses(doses)
    if any(dose.status == DoseStatus.APPROVED for dose in titer_doses):
        return "titer"
    return None


def _required_standard_doses(
    doses: list[StudentVaccineDose],
) -> list[StudentVaccineDose]:
    return [
        dose
        for dose in doses
        if dose.dose_config is not None
        and dose.dose_config.is_required
        and not _is_titer_dose(dose)
    ]


def _first_required_standard_dose(
    doses: list[StudentVaccineDose],
) -> StudentVaccineDose | None:
    required = sorted(_required_standard_doses(doses), key=lambda dose: dose.dose_number)
    return required[0] if required else None


def _titer_doses(doses: list[StudentVaccineDose]) -> list[StudentVaccineDose]:
    return [dose for dose in doses if _is_titer_dose(dose)]


def _is_titer_dose(dose: StudentVaccineDose) -> bool:
    config = dose.dose_config
    return bool(config is not None and config.dose_type == DoseType.TITER)


def _has_standard_dose_record(doses: list[StudentVaccineDose]) -> bool:
    return any(dose.applied_date is not None for dose in doses)
