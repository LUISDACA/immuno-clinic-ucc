import unittest
from datetime import date
from types import SimpleNamespace

from app.modules.admin.reports.exporter import StudentCsvExporter


class AdminReportTests(unittest.TestCase):
    def test_dose_columns_are_unique_and_stable(self) -> None:
        exporter = StudentCsvExporter()
        first_student = SimpleNamespace(
            student_vaccines=[
                SimpleNamespace(
                    vaccine=SimpleNamespace(name="Hepatitis B"),
                    doses=[
                        SimpleNamespace(dose_config=SimpleNamespace(label="Dosis 1")),
                        SimpleNamespace(dose_config=SimpleNamespace(label="Dosis 2")),
                    ],
                )
            ]
        )
        second_student = SimpleNamespace(
            student_vaccines=[
                SimpleNamespace(
                    vaccine=SimpleNamespace(name="Hepatitis B"),
                    doses=[
                        SimpleNamespace(dose_config=SimpleNamespace(label="Dosis 1")),
                    ],
                )
            ]
        )

        columns = exporter._dose_columns([first_student, second_student])

        self.assertEqual(
            columns,
            ["Hepatitis B - Dosis 1", "Hepatitis B - Dosis 2"],
        )

    def test_student_dose_map_uses_date_or_missing_marker(self) -> None:
        exporter = StudentCsvExporter()
        student = SimpleNamespace(
            student_vaccines=[
                SimpleNamespace(
                    vaccine=SimpleNamespace(name="Triple Viral"),
                    doses=[
                        SimpleNamespace(
                            dose_config=SimpleNamespace(label="Dosis 1"),
                            applied_date=date(2026, 4, 30),
                        ),
                        SimpleNamespace(
                            dose_config=SimpleNamespace(label="Dosis 2"),
                            applied_date=None,
                        ),
                    ],
                )
            ]
        )

        dose_map = exporter._student_dose_map(student)

        self.assertEqual(dose_map["Triple Viral - Dosis 1"], "2026-04-30")
        self.assertEqual(dose_map["Triple Viral - Dosis 2"], "No hay registro")


if __name__ == "__main__":
    unittest.main()
