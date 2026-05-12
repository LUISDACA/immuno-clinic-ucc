"""Certificate module - PDF generation service."""

import io
import uuid
from datetime import date, datetime, timezone
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import DoseStatus, Role
from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.rules import (
    certificate_completion_label,
    certificate_initial_dose_complete,
    certificate_overdue_doses,
    due_info_by_dose,
)
from app.modules.vaccination_scheme.service import SchemeService


class CertificateService:
    """Generate vaccination scheme certificate PDFs."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.scheme_service = SchemeService(SchemeRepository(db), VaccineRepository(db))
        self.user_repo = UserRepository(db)

    async def generate_certificate(
        self,
        user_id: uuid.UUID,
        *,
        requesting_admin_id: uuid.UUID | None = None,
    ) -> io.BytesIO:
        """Generate a PDF certificate when the student is current with dose deadlines."""
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise BadRequestException("Usuario no encontrado")

        vaccines = await self.scheme_service.get_student_scheme(user_id)
        today = date.today()

        if not vaccines:
            raise BadRequestException("El estudiante no tiene esquema de vacunacion asignado.")

        missing_initial = [v for v in vaccines if not certificate_initial_dose_complete(v)]
        if missing_initial:
            names = ", ".join(v.vaccine.name for v in missing_initial if v.vaccine)
            raise BadRequestException(
                f"No se puede generar el certificado. Falta la primera dosis aprobada de: {names}."
            )

        overdue = [
            due_info
            for vaccine in vaccines
            for due_info in certificate_overdue_doses(vaccine, today=today)
        ]
        if overdue:
            detail = "; ".join(
                f"{due_info.vaccine_name} - {due_info.dose_label} "
                f"vencio el {due_info.due_date.strftime('%d/%m/%Y')}"
                for due_info in overdue
            )
            raise BadRequestException(
                f"No se puede generar el certificado porque hay dosis con plazo vencido. {detail}."
            )

        responsible_admin = await self._resolve_responsible_admin(
            user,
            requesting_admin_id=requesting_admin_id,
        )

        return self._render_pdf(
            user,
            vaccines,
            responsible_admin=responsible_admin,
            today=today,
        )

    async def _resolve_responsible_admin(
        self,
        user,
        *,
        requesting_admin_id: uuid.UUID | None,
    ):
        if requesting_admin_id is not None:
            admin = await self.user_repo.get_by_id(requesting_admin_id)
            if admin is not None and admin.role == Role.ADMIN:
                return admin

        profile = user.profile
        if profile is None:
            return None
        return await self.user_repo.find_admin_by_scope(profile.program, profile.campus)

    def _render_pdf(self, user, vaccines, *, responsible_admin, today: date) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            rightMargin=0.45 * inch,
            leftMargin=0.45 * inch,
            topMargin=0.45 * inch,
            bottomMargin=0.45 * inch,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CertTitle",
            parent=styles["Title"],
            fontSize=18,
            spaceAfter=8,
            textColor=colors.HexColor("#1a5276"),
        )
        subtitle_style = ParagraphStyle(
            "CertSubtitle",
            parent=styles["Heading2"],
            fontSize=12,
            spaceAfter=6,
            textColor=colors.HexColor("#2c3e50"),
        )
        normal_style = styles["Normal"]
        small_style = ParagraphStyle("Small", parent=normal_style, fontSize=8, leading=10)
        cell_style = ParagraphStyle("Cell", parent=normal_style, fontSize=7.5, leading=9)

        elements = [
            Paragraph(escape(settings.APP_NAME), title_style),
            Paragraph("Certificado de seguimiento de esquema de vacunación", subtitle_style),
            Paragraph(
                "Documento emitido porque el estudiante registra la primera dosis aprobada "
                "de cada vacuna aplicable y no presenta dosis vencidas.",
                small_style,
            ),
            Spacer(1, 8),
        ]

        profile = user.profile
        if profile:
            info_data = [
                ["Nombre completo:", f"{profile.first_name} {profile.last_name}".strip()],
                ["Email:", user.email],
                ["Cédula:", profile.document_number or "N/A"],
                ["ID institucional:", profile.student_id or "N/A"],
                ["Programa:", profile.program or "N/A"],
                ["Campus:", profile.campus or "N/A"],
                ["Teléfono:", profile.phone or "N/A"],
                ["Semestre:", str(profile.semester) if profile.semester else "N/A"],
            ]
            info_table = Table(
                self._two_column_info(info_data, small_style),
                colWidths=[1.25 * inch, 3.25 * inch, 1.25 * inch, 3.25 * inch],
            )
            info_table.setStyle(self._info_table_style())
            elements.append(info_table)
            elements.append(Spacer(1, 12))

        elements.append(Paragraph("Detalle del esquema y próximas aplicaciones", subtitle_style))
        elements.append(Spacer(1, 6))

        table_data = [["Vacuna", "Dosis", "Fecha aplicada", "Estado", "Próxima fecha / plazo"]]
        for student_vaccine in vaccines:
            vaccine_name = student_vaccine.vaccine.name if student_vaccine.vaccine else "N/A"
            completion_label = certificate_completion_label(student_vaccine)
            due_by_dose = due_info_by_dose(student_vaccine, today=today)

            for dose in student_vaccine.doses:
                label = dose.dose_config.label if dose.dose_config else f"Dosis {dose.dose_number}"
                applied = dose.applied_date.strftime("%d/%m/%Y") if dose.applied_date else "N/A"
                status = self._dose_status_label(dose.status)
                if completion_label == "Titulacion aprobada" and dose.status != DoseStatus.APPROVED:
                    status = "Cubierta por titulacion"

                due_info = due_by_dose.get(dose.id)
                if due_info is not None:
                    due_text = due_info.due_date.strftime("%d/%m/%Y")
                elif dose.applied_date is not None:
                    due_text = "Cumplida"
                else:
                    due_text = "Sin fecha programada"

                table_data.append(
                    [
                        Paragraph(escape(vaccine_name), cell_style),
                        Paragraph(escape(label), cell_style),
                        Paragraph(escape(applied), cell_style),
                        Paragraph(escape(status), cell_style),
                        Paragraph(escape(due_text), cell_style),
                    ]
                )
                vaccine_name = ""

        vaccine_table = Table(
            table_data,
            colWidths=[1.35 * inch, 2.6 * inch, 1.1 * inch, 1.35 * inch, 1.5 * inch],
            repeatRows=1,
        )
        vaccine_table.setStyle(self._vaccine_table_style())
        elements.append(vaccine_table)
        elements.append(Spacer(1, 14))

        elements.append(Paragraph("Responsables", subtitle_style))
        responsibility_table = Table(
            self._two_column_info(
                self._responsibility_info(responsible_admin),
                small_style,
            ),
            colWidths=[1.65 * inch, 2.85 * inch, 1.2 * inch, 3.3 * inch],
        )
        responsibility_table.setStyle(self._info_table_style())
        elements.append(responsibility_table)
        elements.append(Spacer(1, 10))

        now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
        elements.append(
            Paragraph(
                f"Certificado generado el {now}",
                ParagraphStyle("Footer", parent=normal_style, fontSize=8, textColor=colors.grey),
            )
        )
        elements.append(
            Paragraph(
                "Este documento no reemplaza el cumplimiento de las próximas dosis indicadas.",
                ParagraphStyle("Footer2", parent=normal_style, fontSize=8, textColor=colors.grey),
            )
        )

        doc.build(elements)
        buffer.seek(0)
        return buffer

    @staticmethod
    def _dose_status_label(status: DoseStatus) -> str:
        return {
            DoseStatus.APPROVED: "Aprobada",
            DoseStatus.DENIED: "Denegada",
            DoseStatus.IN_REVIEW: "En revisión",
            DoseStatus.PENDING: "Pendiente",
        }.get(status, status.value)

    @staticmethod
    def _responsibility_info(responsible_admin) -> list[list[str]]:
        responsible_name = "No asignado"
        responsible_email = "N/A"
        responsible_title = "Administrador normal"
        if responsible_admin is not None:
            admin_profile = responsible_admin.profile
            if admin_profile is not None:
                responsible_name = f"{admin_profile.first_name} {admin_profile.last_name}".strip()
                if admin_profile.job_title:
                    responsible_title = admin_profile.job_title
            responsible_email = responsible_admin.email
        return [
            ["Administrador responsable:", responsible_name],
            ["Cargo:", responsible_title],
            ["Correo:", responsible_email],
            ["Aplicación:", f"{settings.APP_NAME} v{settings.APP_VERSION}"],
        ]

    @staticmethod
    def _two_column_info(rows: list[list[str]], style: ParagraphStyle) -> list[list[Paragraph]]:
        rendered = []
        iterator = iter(rows)
        for left in iterator:
            right = next(iterator, ["", ""])
            rendered.append(
                [
                    Paragraph(escape(left[0]), style),
                    Paragraph(escape(str(left[1])), style),
                    Paragraph(escape(right[0]), style),
                    Paragraph(escape(str(right[1])), style),
                ]
            )
        return rendered

    @staticmethod
    def _info_table_style() -> TableStyle:
        return TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#34495e")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
            ]
        )

    @staticmethod
    def _vaccine_table_style() -> TableStyle:
        return TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a5276")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("ALIGN", (2, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#ebf5fb")],
                ),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
            ]
        )
