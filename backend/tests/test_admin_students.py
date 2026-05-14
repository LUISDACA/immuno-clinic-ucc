import unittest
from types import SimpleNamespace

from app.common.enums import Gender, Role
from app.core.exceptions import ForbiddenException
from app.modules.admin.schemas import CreateStudentRequest
from app.modules.admin.students.service import StudentAdminService


class AdminStudentTests(unittest.TestCase):
    def test_normal_admin_scope_is_applied_to_new_student(self) -> None:
        service = StudentAdminService.__new__(StudentAdminService)
        admin = SimpleNamespace(
            role=Role.ADMIN,
            profile=SimpleNamespace(program="Medicina", campus="Bogotá"),
        )
        request = CreateStudentRequest(
            email="student@example.edu",
            password="temporary-secret",
            first_name="Ada",
            last_name="Lovelace",
            document_number="123",
            sex=Gender.FEMALE,
        )

        scoped = service._apply_admin_scope_to_student_data(admin, request)

        self.assertEqual(scoped.program, "Medicina")
        self.assertEqual(scoped.campus, "Bogotá")

    def test_normal_admin_cannot_create_student_outside_scope(self) -> None:
        service = StudentAdminService.__new__(StudentAdminService)
        admin = SimpleNamespace(
            role=Role.ADMIN,
            profile=SimpleNamespace(program="Medicina", campus="Bogotá"),
        )
        request = CreateStudentRequest(
            email="student@example.edu",
            password="temporary-secret",
            first_name="Ada",
            last_name="Lovelace",
            document_number="123",
            sex=Gender.FEMALE,
            program="Odontología",
            campus="Bogotá",
        )

        with self.assertRaises(ForbiddenException):
            service._apply_admin_scope_to_student_data(admin, request)


if __name__ == "__main__":
    unittest.main()
