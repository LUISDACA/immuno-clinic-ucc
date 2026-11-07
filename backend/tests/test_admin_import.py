import unittest

from app.common.enums import Gender
from app.modules.admin.import_students.service import student_import_row_to_request


class AdminImportTests(unittest.TestCase):
    def test_imported_student_does_not_derive_password_from_document(self) -> None:
        request, temporary_password = student_import_row_to_request(
            {
                "email": "student@example.edu",
                "document_number": "123456789",
                "first_name": "Ada",
                "last_name": "Lovelace",
                "sex": "F",
                "program": "Medicina",
                "semester": "4",
            }
        )

        self.assertEqual(request.email, "student@example.edu")
        self.assertEqual(request.sex, Gender.FEMALE)
        self.assertEqual(request.semester, 4)
        self.assertIsNone(request.password)
        self.assertIsNone(temporary_password)

    def test_imported_student_can_split_full_name(self) -> None:
        request, _ = student_import_row_to_request(
            {
                "email": "student@example.edu",
                "document_number": "123456789",
                "full_name": "Grace Murray Hopper",
                "sex": "female",
            }
        )

        self.assertEqual(request.first_name, "Grace Murray")
        self.assertEqual(request.last_name, "Hopper")


if __name__ == "__main__":
    unittest.main()
