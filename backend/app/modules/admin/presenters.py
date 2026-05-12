"""Presentation helpers for admin API responses."""

from app.common.enums import VaccineStatus
from app.modules.users.models import User
from app.modules.users.schemas import UserResponse


def student_vaccination_status(student: User) -> str:
    vaccines = list(student.student_vaccines or [])
    if not vaccines:
        return VaccineStatus.PENDING.value

    statuses = [vaccine.status for vaccine in vaccines]
    if any(status == VaccineStatus.DENIED for status in statuses):
        return VaccineStatus.DENIED.value
    if statuses and all(status == VaccineStatus.APPROVED for status in statuses):
        return VaccineStatus.APPROVED.value
    return VaccineStatus.PENDING.value


def student_list_item(student: User) -> dict:
    data = UserResponse.model_validate(student).model_dump(mode="json")
    data["vaccination_status"] = student_vaccination_status(student)
    return data
