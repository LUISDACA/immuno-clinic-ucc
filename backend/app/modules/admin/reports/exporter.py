"""CSV exporter for admin student reports."""

import csv
import io

from app.modules.users.models import User


class StudentCsvExporter:
    """Renders student vaccination report rows as CSV."""

    def export(self, students: list[User]) -> str:
        dose_columns = self._dose_columns(students)
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(self._student_export_headers(dose_columns))

        for student in students:
            row = self._student_export_row(student)
            dose_map = self._student_dose_map(student)
            row.extend(dose_map.get(column, "No aplica") for column in dose_columns)
            writer.writerow(row)

        return output.getvalue()

    def _dose_columns(self, students: list[User]) -> list[str]:
        columns: list[str] = []
        seen: set[str] = set()
        for student in students:
            for student_vaccine in student.student_vaccines:
                for dose in student_vaccine.doses:
                    column = f"{student_vaccine.vaccine.name} - {dose.dose_config.label}"
                    if column not in seen:
                        seen.add(column)
                        columns.append(column)
        return columns

    def _student_export_headers(self, dose_columns: list[str]) -> list[str]:
        return [
            "Nombre",
            "Correo",
            "Documento",
            "ID Estudiantil",
            "Fecha de Nacimiento",
            "Sexo",
            "Teléfono",
            "EPS Afiliado",
            "Contacto de Emergencia",
            "Teléfono Contacto de Emergencia",
            "Semestre",
            "Programa",
            "Campus",
            "Estado de Cuenta",
        ] + dose_columns

    def _student_export_row(self, student: User) -> list[object]:
        profile = student.profile
        return [
            f"{profile.first_name} {profile.last_name}" if profile else "",
            student.email,
            profile.document_number if profile else "",
            profile.student_id if profile else "",
            profile.birth_date.strftime("%Y-%m-%d") if profile and profile.birth_date else "",
            profile.sex.value if profile and profile.sex else "",
            profile.phone if profile else "",
            profile.eps_affiliation if profile else "",
            profile.emergency_contact_name if profile else "",
            profile.emergency_contact_phone if profile else "",
            profile.semester if profile else "",
            profile.program if profile else "",
            profile.campus if profile else "",
            "Activo" if student.is_active else "Inactivo",
        ]

    def _student_dose_map(self, student: User) -> dict[str, str]:
        dose_map: dict[str, str] = {}
        for student_vaccine in student.student_vaccines:
            for dose in student_vaccine.doses:
                column = f"{student_vaccine.vaccine.name} - {dose.dose_config.label}"
                dose_map[column] = (
                    dose.applied_date.strftime("%Y-%m-%d")
                    if dose.applied_date
                    else "No hay registro"
                )
        return dose_map
