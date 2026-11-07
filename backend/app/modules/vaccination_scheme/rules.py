"""Vaccination schedule rules and due-date calculation."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from app.common.enums import DoseStatus, DoseType, VaccineStatus
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from dateutil.relativedelta import relativedelta

INSTITUTIONAL_TIMEZONE = ZoneInfo("America/Bogota")


def clinical_today() -> date:
    """Return the institutional calendar date; clinical dates are not UTC instants."""
    return datetime.now(INSTITUTIONAL_TIMEZONE).date()


@dataclass(frozen=True)
class DoseDueInfo:
    """Due-date information for a vaccine dose."""

    dose_id: UUID
    dose_number: int
    vaccine_name: str
    dose_label: str
    due_date: date
    days_until_due: int

    @property
    def is_overdue(self) -> bool:
        return self.days_until_due < 0

    @property
    def is_due_today(self) -> bool:
        return self.days_until_due == 0


def due_info_by_dose(
    student_vaccine: StudentVaccine,
    *,
    today: date | None = None,
) -> dict[UUID, DoseDueInfo]:
    """Return calculated due dates keyed by student dose id."""
    today = today or clinical_today()
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

    if vaccine.is_annual:
        dose = doses.get(1)
        if dose is not None and dose.applied_date is not None:
            due_date = annual_anniversary_in_year(
                dose.applied_date,
                dose.applied_date.year + 1,
            )
            result[dose.id] = _build_due_info(student_vaccine, dose, due_date, today)
        return result

    schedule = next(
        (
            rule.rule_config
            for rule in (vaccine.rules or [])
            if rule.rule_type == "schedule" and rule.rule_config
        ),
        {},
    )
    for interval in schedule.get("intervals", []):
        try:
            delta = relativedelta(
                months=int(interval.get("months", 0)),
                years=int(interval.get("years", 0)),
                days=int(interval.get("days", 0)),
            )
            add_sequence_due(
                source_number=int(interval["from_dose"]),
                target_number=int(interval["to_dose"]),
                delta=delta,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Invalid active vaccine schedule rule.") from exc

    return result


def annual_anniversary_in_year(application_date: date, year: int) -> date:
    """Return the calendar anniversary, clamping Feb 29 to Feb 28 if needed."""
    day = application_date.day
    if application_date.month == 2 and day == 29 and not calendar.isleap(year):
        day = 28
    return date(year, application_date.month, day)


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


def certificate_vaccine_complete(
    student_vaccine: StudentVaccine,
    *,
    today: date | None = None,
) -> bool:
    """Return whether a vaccine satisfies certificate approval rules."""
    return _certificate_path(student_vaccine, today=today or clinical_today()) is not None


@dataclass(frozen=True)
class SchemeEvaluation:
    """Backend-owned clinical signals for one evaluation date."""

    is_up_to_date: bool
    is_complete: bool
    is_certifiable: bool


def evaluate_scheme(
    vaccines: list[StudentVaccine],
    *,
    today: date | None = None,
) -> SchemeEvaluation:
    """Evaluate approved predicates without mutating ORM state."""
    evaluation_date = today or clinical_today()
    if not vaccines:
        return SchemeEvaluation(False, False, False)

    up_to_date = all(_vaccine_up_to_date(vaccine, evaluation_date) for vaccine in vaccines)
    complete = all(
        certificate_vaccine_complete(vaccine, today=evaluation_date) for vaccine in vaccines
    )
    has_denied_dose = any(
        dose.status == DoseStatus.DENIED for vaccine in vaccines for dose in vaccine.doses
    )
    return SchemeEvaluation(
        is_up_to_date=up_to_date,
        is_complete=complete,
        is_certifiable=up_to_date and not has_denied_dose,
    )


def validate_application_date(applied_date: date | None, *, today: date | None = None) -> None:
    """Reject future application dates; historical dates have no lower bound."""
    if applied_date is not None and applied_date > (today or clinical_today()):
        raise ValueError("La fecha de aplicación no puede ser futura.")


def _vaccine_up_to_date(student_vaccine: StudentVaccine, today: date) -> bool:
    vaccine = student_vaccine.vaccine
    if (
        vaccine is not None
        and vaccine.has_titer
        and any(dose.status == DoseStatus.APPROVED for dose in _titer_doses(student_vaccine.doses))
    ):
        return True

    # Annual vaccines become overdue the day after their anniversary. The
    # anniversary itself remains valid for the whole calendar day.
    if vaccine is not None and vaccine.is_annual:
        due_info = due_info_by_dose(student_vaccine, today=today)
        if any(info.due_date < today for info in due_info.values()):
            return False

    required = _required_standard_doses(student_vaccine.doses)
    due_dates = {
        item.dose_id: item.due_date
        for item in due_info_by_dose(student_vaccine, today=today).values()
    }
    for dose in required:
        due_date = due_dates.get(dose.id)
        # The first requirement applies immediately. Later requirements apply
        # only after their configured sequence has produced a due date.
        corresponds = dose.dose_number == 1 or dose.applied_date is not None
        if due_date is not None:
            corresponds = due_date <= today or dose.applied_date is not None
        if corresponds and dose.status != DoseStatus.APPROVED:
            return False
    return True


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


def _certificate_path(student_vaccine: StudentVaccine, *, today: date | None = None) -> str | None:
    doses = list(student_vaccine.doses)
    vaccine = student_vaccine.vaccine

    # A valid approved titer covers all requirements for this vaccine.
    if vaccine is not None and vaccine.has_titer:
        titer_doses = _titer_doses(doses)
        if any(dose.status == DoseStatus.APPROVED for dose in titer_doses):
            return "titer"

    if vaccine is not None and vaccine.is_annual and today is not None:
        annual_due = due_info_by_dose(student_vaccine, today=today)
        if any(item.due_date < today for item in annual_due.values()):
            return None

    standard_required = _required_standard_doses(doses)
    if standard_required and all(dose.status == DoseStatus.APPROVED for dose in standard_required):
        return "doses"

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
