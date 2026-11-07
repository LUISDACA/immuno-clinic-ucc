"""Student import application service."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.common.enums import AuditAction, DoseStatus
from app.core.exceptions import BadRequestException, ConflictException
from app.modules.admin.import_students.import_helpers import (
    clean_cell,
    dose_candidate_keys,
    dose_header_kind,
    dose_header_match_key,
    dose_header_matches,
    field_for_header,
    imported_dose_ready_for_approval,
    is_empty_cell,
    parse_date,
    read_csv_rows,
    read_xlsx_rows,
    student_import_row_to_request,
)
from app.modules.admin.schemas import (
    ImportPreviewResponse,
    ImportPreviewRow,
    ImportStudentRowResult,
    ImportStudentsResponse,
)
from app.modules.users.models import User
from app.modules.vaccination_scheme.models import StudentVaccineDose
from fastapi import UploadFile
from pydantic import ValidationError

if TYPE_CHECKING:
    from app.modules.admin.service import AdminDependencies


logger = logging.getLogger(__name__)


class AdminStudentImportService:
    """Imports students and vaccine evidence from CSV/XLSX files."""

    def __init__(self, admin_deps: AdminDependencies):
        self.admin_deps = admin_deps

    async def import_students_from_file(
        self,
        admin: User,
        file: UploadFile,
    ) -> ImportStudentsResponse:
        content = await file.read()
        filename = (file.filename or "").lower()
        rows = read_csv_rows(content) if filename.endswith(".csv") else read_xlsx_rows(content)

        if not rows:
            raise BadRequestException("El archivo no tiene filas para importar")

        header_index = next(
            (
                index
                for index, row in enumerate(rows)
                if any(field_for_header(cell) for cell in row)
            ),
            None,
        )
        if header_index is None:
            raise BadRequestException("No se encontraron encabezados reconocibles en el archivo")

        field_by_index = {
            index: field
            for index, header in enumerate(rows[header_index])
            if (field := field_for_header(header)) is not None
        }
        dose_column_by_index = {
            index: header
            for index, header in enumerate(rows[header_index])
            if index not in field_by_index and clean_cell(header)
        }

        results: list[ImportStudentRowResult] = []
        created = 0
        skipped = 0
        errors = 0

        for row_number, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
            if not any(clean_cell(value) for value in row):
                continue

            raw = {
                field: row[index] if index < len(row) else None
                for index, field in field_by_index.items()
            }
            dose_raw = {
                str(header): row[index] if index < len(row) else None
                for index, header in dose_column_by_index.items()
            }
            email = clean_cell(raw.get("email"))
            try:
                data, _ = student_import_row_to_request(raw)
                existing = await self.admin_deps.user_repo.get_by_email(data.email)
                if existing:
                    skipped += 1
                    results.append(
                        ImportStudentRowResult(
                            row=row_number,
                            email=data.email,
                            status="skipped",
                            message="Ya existe un usuario con ese correo",
                        )
                    )
                    continue

                student = await self.admin_deps.student_service.create_student(admin, data)
                dose_updates, dose_warnings = await self._apply_imported_scheme_data(
                    admin=admin,
                    student=student,
                    values=dose_raw,
                )
                created += 1
                message = "Estudiante creado; el acceso se gestiona por correo"
                if dose_updates:
                    message += f"; {dose_updates} dato(s) de vacunas importado(s)"
                if dose_warnings:
                    message += f"; revisar: {'; '.join(dose_warnings[:3])}"
                results.append(
                    ImportStudentRowResult(
                        row=row_number,
                        email=student.email if student else data.email,
                        status="created",
                        message=message,
                    )
                )
            except (ValueError, ValidationError, BadRequestException, ConflictException) as exc:
                await self.admin_deps.db.rollback()
                errors += 1
                results.append(
                    ImportStudentRowResult(
                        row=row_number,
                        email=email,
                        status="error",
                        message=str(exc),
                    )
                )
            except Exception as exc:
                await self.admin_deps.db.rollback()
                logger.exception(
                    "Unexpected student import error at row=%s email=%s",
                    row_number,
                    email,
                )
                errors += 1
                results.append(
                    ImportStudentRowResult(
                        row=row_number,
                        email=email,
                        status="error",
                        message=f"No se pudo importar la fila: {exc}",
                    )
                )

        return ImportStudentsResponse(
            total_rows=len(results),
            created=created,
            skipped=skipped,
            errors=errors,
            results=results,
        )

    async def preview_import(
        self,
        file: UploadFile,
    ) -> ImportPreviewResponse:
        """Parse a CSV/XLSX file and predict per-row outcomes without writing to the DB."""
        content = await file.read()
        filename = (file.filename or "").lower()
        rows = read_csv_rows(content) if filename.endswith(".csv") else read_xlsx_rows(content)

        if not rows:
            return ImportPreviewResponse(
                total_rows=0, will_create=0, will_skip=0, errors=0, rows=[]
            )

        header_index = next(
            (
                index
                for index, row in enumerate(rows)
                if any(field_for_header(cell) for cell in row)
            ),
            None,
        )
        if header_index is None:
            return ImportPreviewResponse(
                total_rows=0, will_create=0, will_skip=0, errors=0, rows=[]
            )

        field_by_index = {
            index: field
            for index, header in enumerate(rows[header_index])
            if (field := field_for_header(header)) is not None
        }

        # Collect all emails in the file to batch-check existence
        candidate_emails: list[str] = []
        data_rows = [row for row in rows[header_index + 1 :] if any(clean_cell(v) for v in row)]
        for row in data_rows:
            raw = {
                field: row[index] if index < len(row) else None
                for index, field in field_by_index.items()
            }
            email = clean_cell(raw.get("email"))
            if email:
                candidate_emails.append(email.lower())

        existing_emails: set[str] = set()
        if candidate_emails:
            from app.modules.users.models import User as UserModel
            from sqlalchemy import select as sa_select

            result = await self.admin_deps.db.execute(
                sa_select(UserModel.email).where(UserModel.email.in_(candidate_emails))
            )
            existing_emails = {row[0].lower() for row in result.all()}

        preview_rows: list[ImportPreviewRow] = []
        will_create = 0
        will_skip = 0
        errors = 0

        for row_number, row in enumerate(data_rows, start=header_index + 2):
            raw = {
                field: row[index] if index < len(row) else None
                for index, field in field_by_index.items()
            }
            email = clean_cell(raw.get("email"))
            try:
                data, _ = student_import_row_to_request(raw)
                name = f"{data.first_name} {data.last_name}"
                if (email or "").lower() in existing_emails:
                    will_skip += 1
                    preview_rows.append(
                        ImportPreviewRow(
                            row=row_number,
                            email=email,
                            name=name,
                            predicted_status="will_skip",
                            message="Ya existe un usuario con este correo",
                        )
                    )
                else:
                    will_create += 1
                    preview_rows.append(
                        ImportPreviewRow(
                            row=row_number,
                            email=email,
                            name=name,
                            predicted_status="will_create",
                            message="Se creará el estudiante",
                        )
                    )
            except (ValueError, Exception) as exc:
                errors += 1
                preview_rows.append(
                    ImportPreviewRow(
                        row=row_number,
                        email=email,
                        predicted_status="error",
                        message=str(exc),
                    )
                )

        return ImportPreviewResponse(
            total_rows=len(preview_rows),
            will_create=will_create,
            will_skip=will_skip,
            errors=errors,
            rows=preview_rows,
        )

    async def _apply_imported_scheme_data(
        self,
        admin: User,
        student: User | None,
        values: dict[str, object],
    ) -> tuple[int, list[str]]:
        if student is None or not values:
            return 0, []

        scheme = await self.admin_deps.scheme_service.get_student_scheme(student.id)
        dose_lookup: list[tuple[StudentVaccineDose, list[str]]] = []
        for vaccine in scheme:
            for dose in vaccine.doses:
                dose_lookup.append((dose, dose_candidate_keys(dose)))

        updated = 0
        warnings: list[str] = []
        touched_doses: dict[str, StudentVaccineDose] = {}

        for header, value in values.items():
            if is_empty_cell(value):
                continue

            header_key = dose_header_match_key(header)
            match = next(
                (
                    dose
                    for dose, keys in dose_lookup
                    if any(
                        key
                        and (
                            key in header_key
                            or header_key in key
                            or dose_header_matches(header_key, key)
                        )
                        for key in keys
                    )
                ),
                None,
            )
            if match is None:
                warnings.append(f"No se reconoció la columna '{header}'")
                continue

            before = {
                "applied_date": match.applied_date,
                "titer_value": match.titer_value,
            }
            try:
                if dose_header_kind(header) == "titer_value":
                    match.titer_value = clean_cell(value)
                else:
                    match.applied_date = parse_date(value)
            except ValueError as exc:
                warnings.append(f"{header}: {exc}")
                continue

            touched_doses[str(match.id)] = match

            after = {
                "applied_date": match.applied_date,
                "titer_value": match.titer_value,
            }
            if before != after:
                updated += 1
                await self.admin_deps.audit.log(
                    actor_id=admin.id,
                    action=AuditAction.DOSE_UPDATED,
                    target_type="student_vaccine_dose",
                    target_id=match.id,
                    details={
                        "student_id": str(student.id),
                        "source": "excel_import",
                        "vaccine": match.student_vaccine.vaccine.name
                        if match.student_vaccine and match.student_vaccine.vaccine
                        else None,
                        "dose": match.dose_config.label if match.dose_config else None,
                        "changes": {
                            key: {
                                "old": before[key].isoformat()
                                if hasattr(before[key], "isoformat")
                                else before[key],
                                "new": after[key].isoformat()
                                if hasattr(after[key], "isoformat")
                                else after[key],
                            }
                            for key in before
                            if before[key] != after[key]
                        },
                    },
                )

        approved_at = datetime.now(timezone.utc)
        for dose in touched_doses.values():
            if not imported_dose_ready_for_approval(dose):
                continue

            previous_status = dose.status
            dose.status = DoseStatus.APPROVED
            dose.admin_notes = "Aprobada automáticamente desde importación Excel"
            dose.reviewed_by = admin.id
            dose.reviewed_at = approved_at

            if previous_status != DoseStatus.APPROVED:
                updated += 1
                await self.admin_deps.audit.log(
                    actor_id=admin.id,
                    action=AuditAction.DOSE_REVIEWED,
                    target_type="student_vaccine_dose",
                    target_id=dose.id,
                    details={
                        "student_id": str(student.id),
                        "source": "excel_import",
                        "vaccine": dose.student_vaccine.vaccine.name
                        if dose.student_vaccine and dose.student_vaccine.vaccine
                        else None,
                        "dose": dose.dose_config.label if dose.dose_config else None,
                        "old_status": previous_status.value,
                        "new_status": DoseStatus.APPROVED.value,
                    },
                )

        for vaccine in scheme:
            vaccine.status = self.admin_deps.scheme_service.recalculate_vaccine_status(
                vaccine.doses
            )
            if any(str(dose.id) in touched_doses for dose in vaccine.doses):
                vaccine.reviewed_by = admin.id
                vaccine.reviewed_at = approved_at

        if updated:
            await self.admin_deps.db.commit()
        return updated, warnings
