import unittest
from types import SimpleNamespace

from app.common.enums import DoseStatus
from app.modules.admin.dose_reviews.service import DoseReviewService
from app.modules.vaccination_scheme.schemas import ReviewDoseRequest


class AdminDoseReviewTests(unittest.TestCase):
    def test_approved_review_notification_content(self) -> None:
        service = DoseReviewService.__new__(DoseReviewService)
        dose = SimpleNamespace(
            student_vaccine=SimpleNamespace(
                vaccine=SimpleNamespace(name="Hepatitis B"),
            ),
            dose_config=SimpleNamespace(label="Dosis 1"),
        )

        title, message = service._review_notification_content(
            dose,
            ReviewDoseRequest(status=DoseStatus.APPROVED),
        )

        self.assertEqual(title, "Dosis aprobada")
        self.assertIn("Hepatitis B", message)
        self.assertIn("Dosis 1", message)

    def test_denied_review_notification_uses_default_reason(self) -> None:
        service = DoseReviewService.__new__(DoseReviewService)
        dose = SimpleNamespace(
            student_vaccine=SimpleNamespace(
                vaccine=SimpleNamespace(name="Triple Viral"),
            ),
            dose_config=SimpleNamespace(label="Dosis 2"),
        )

        title, message = service._review_notification_content(
            dose,
            ReviewDoseRequest(status=DoseStatus.DENIED),
        )

        self.assertEqual(title, "Dosis rechazada")
        self.assertIn("Triple Viral", message)
        self.assertIn("Revisar detalles en el sistema", message)


if __name__ == "__main__":
    unittest.main()
