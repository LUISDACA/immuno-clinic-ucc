import unittest
from types import SimpleNamespace

from app.common.enums import VaccineStatus
from app.modules.admin.presenters import student_vaccination_status


class AdminPresenterTests(unittest.TestCase):
    def test_student_without_vaccines_is_pending(self) -> None:
        student = SimpleNamespace(student_vaccines=[])

        status = student_vaccination_status(student)

        self.assertEqual(status, VaccineStatus.PENDING.value)

    def test_student_with_any_denied_vaccine_is_denied(self) -> None:
        student = SimpleNamespace(
            student_vaccines=[
                SimpleNamespace(status=VaccineStatus.APPROVED),
                SimpleNamespace(status=VaccineStatus.DENIED),
            ]
        )

        status = student_vaccination_status(student)

        self.assertEqual(status, VaccineStatus.DENIED.value)

    def test_student_with_all_approved_vaccines_is_approved(self) -> None:
        student = SimpleNamespace(
            student_vaccines=[
                SimpleNamespace(status=VaccineStatus.APPROVED),
                SimpleNamespace(status=VaccineStatus.APPROVED),
            ]
        )

        status = student_vaccination_status(student)

        self.assertEqual(status, VaccineStatus.APPROVED.value)


if __name__ == "__main__":
    unittest.main()
