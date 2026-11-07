"""Certificate issuance, rendering, integrity and revocation services."""

import hashlib
import io
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

import qrcode
from app.common.enums import Role
from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    CertificateNotEligibleException,
    CertificateSignerException,
)
from app.modules.audit.service import AuditService
from app.modules.certificates.models import (
    CertificateEmission,
    CertificateSignature,
    CertificateSignerAssignment,
    CertificateStatus,
)
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.rules import clinical_today, evaluate_scheme
from app.modules.vaccination_scheme.service import SchemeService
from app.storage.base import StorageService, get_storage_service
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class IssuedCertificate:
    pdf: io.BytesIO
    emission: CertificateEmission


class CertificateService:
    """FastAPI is the sole authority for certification eligibility."""

    def __init__(self, db: AsyncSession, storage: StorageService | None = None):
        self.db = db
        self.storage = storage or get_storage_service()
        self.scheme_service = SchemeService(SchemeRepository(db), VaccineRepository(db))
        self.user_repo = UserRepository(db)

    async def generate_certificate(
        self, user_id: uuid.UUID, *, requesting_admin_id: uuid.UUID | None = None
    ) -> io.BytesIO:
        return (await self.issue_certificate(user_id, requesting_admin_id=requesting_admin_id)).pdf

    async def issue_certificate(
        self, user_id: uuid.UUID, *, requesting_admin_id: uuid.UUID | None = None
    ) -> IssuedCertificate:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise BadRequestException("Usuario no encontrado")
        signer, assignment = await self._resolve_signer(user, requesting_admin_id)
        signature = await self.db.scalar(
            select(CertificateSignature).where(
                CertificateSignature.admin_id == signer.id,
                CertificateSignature.is_active.is_(True),
                CertificateSignature.is_revoked.is_(False),
            )
        )
        if signature is None:
            raise CertificateSignerException(
                "CERTIFICATE_SIGNER_SIGNATURE_MISSING",
                "El responsable no tiene una firma activa configurada.",
            )
        vaccines = await self.scheme_service.get_student_scheme(user_id)
        today = clinical_today()
        if not vaccines:
            raise BadRequestException("El estudiante no tiene esquema de vacunacion asignado.")
        # Do not duplicate or reinterpret clinical policy here.
        if not evaluate_scheme(vaccines, today=today).is_certifiable:
            raise CertificateNotEligibleException()

        signature_bytes = await self.storage.download(signature.storage_key)
        if hashlib.sha256(signature_bytes).hexdigest() != signature.sha256:
            raise RuntimeError("Stored certificate signature integrity check failed")

        issued_at = datetime.now(timezone.utc)
        emission = CertificateEmission(
            public_id=secrets.token_urlsafe(32),
            user_id=user_id,
            issued_at=issued_at,
            status=CertificateStatus.ISSUED,
            document_sha256="0" * 64,
            certificate_version=1,
            signature_id=signature.id,
            signer_admin_id=signer.id,
            signer_assignment_id=assignment.id if assignment else None,
        )
        try:
            self.db.add(emission)
            await self.db.flush()
            verify_url = self._verification_url(emission.public_id)
            pdf = self._render_pdf(
                user,
                verify_url,
                emission.public_id,
                issued_at,
                signature_bytes=signature_bytes,
                signer=signer,
            )
            emission.document_sha256 = hashlib.sha256(pdf.getvalue()).hexdigest()
            await AuditService(self.db).log(
                actor_id=requesting_admin_id or user_id,
                action="certificate.issued",
                target_type="certificate",
                target_id=emission.id,
                details={
                    "certificate_version": emission.certificate_version,
                    "signer_admin_id": str(signer.id),
                    "signer_assignment_id": str(assignment.id) if assignment else None,
                    "signature_id": str(signature.id),
                },
            )
            await self.db.commit()
            pdf.seek(0)
            return IssuedCertificate(pdf=pdf, emission=emission)
        except Exception:
            await self.db.rollback()
            raise

    async def revoke(
        self, certificate_id: uuid.UUID, *, actor_id: uuid.UUID, reason: str
    ) -> CertificateEmission:
        result = await self.db.execute(
            select(CertificateEmission)
            .where(CertificateEmission.id == certificate_id)
            .with_for_update()
        )
        emission = result.scalar_one_or_none()
        if emission is None:
            raise BadRequestException("Certificado no encontrado")
        if emission.status == CertificateStatus.REVOKED:
            return emission
        emission.status = CertificateStatus.REVOKED
        emission.revoked_at = datetime.now(timezone.utc)
        emission.revocation_reason = reason.strip()
        emission.revoked_by = actor_id
        try:
            await AuditService(self.db).log(
                actor_id=actor_id,
                action="certificate.revoked",
                target_type="certificate",
                target_id=emission.id,
                details={},
            )
            await self.db.commit()
            return emission
        except Exception:
            await self.db.rollback()
            raise

    @staticmethod
    def _verification_url(public_id: str) -> str:
        configured = getattr(settings, "CERTIFICATE_VERIFY_BASE_URL", None)
        base = (configured or f"{settings.FRONTEND_URL.rstrip('/')}/verify").rstrip("/")
        parsed = urlparse(base)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise RuntimeError("Certificate verification URL is not configured correctly")
        if not settings.DEBUG and parsed.scheme != "https":
            raise RuntimeError("Certificate verification URL must use HTTPS")
        return f"{base}/{public_id}"

    async def _resolve_signer(
        self, student: User, requesting_admin_id: uuid.UUID | None
    ) -> tuple[User, CertificateSignerAssignment | None]:
        """Resolve the explicit scope assignment for self-service issuance."""
        if requesting_admin_id is not None:
            actor = await self.user_repo.get_by_id(requesting_admin_id)
            if actor is not None and actor.role == Role.ADMIN and actor.is_active:
                return actor, None
            if actor is None or actor.role != Role.APP_ADMIN or not actor.is_active:
                raise CertificateSignerException(
                    "CERTIFICATE_SIGNER_NOT_ASSIGNED", "No hay un responsable válido asignado."
                )
        profile = student.profile
        if profile is None or not profile.program or not profile.campus:
            raise CertificateSignerException(
                "CERTIFICATE_SIGNER_SCOPE_MISSING",
                "No es posible determinar el programa y campus del estudiante.",
            )
        assignment = await self.db.scalar(
            select(CertificateSignerAssignment).where(
                CertificateSignerAssignment.program == profile.program,
                CertificateSignerAssignment.campus == profile.campus,
                CertificateSignerAssignment.active.is_(True),
            )
        )
        if assignment is None:
            raise CertificateSignerException(
                "CERTIFICATE_SIGNER_NOT_ASSIGNED",
                "No hay un administrador responsable asignado para este ámbito.",
            )
        signer = await self.user_repo.get_by_id(assignment.admin_id)
        if (
            signer is None
            or signer.role != Role.ADMIN
            or not signer.is_active
            or signer.profile is None
            or signer.profile.program != profile.program
            or signer.profile.campus != profile.campus
        ):
            raise CertificateSignerException(
                "CERTIFICATE_SIGNER_NOT_ASSIGNED",
                "No hay un administrador responsable asignado para este ámbito.",
            )
        return signer, assignment

    @staticmethod
    def _render_pdf(
        user,
        verify_url: str,
        public_id: str,
        issued_at: datetime,
        *,
        signature_bytes: bytes,
        signer: User,
    ) -> io.BytesIO:
        output = io.BytesIO()
        styles = getSampleStyleSheet()
        navy = colors.HexColor("#12304A")
        accent = colors.HexColor("#159A9C")
        title = ParagraphStyle(
            "CertificateTitle",
            parent=styles["Title"],
            fontSize=23,
            leading=28,
            textColor=navy,
            alignment=1,
            spaceAfter=9,
        )
        body = ParagraphStyle(
            "CertificateBody",
            parent=styles["Normal"],
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#263746"),
        )
        muted = ParagraphStyle(
            "CertificateMuted",
            parent=body,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#5B6870"),
        )
        profile = user.profile
        name = (
            " ".join(
                filter(
                    None,
                    [getattr(profile, "first_name", None), getattr(profile, "last_name", None)],
                )
            )
            or "Estudiante"
        )
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=4,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)
        qr_buffer = io.BytesIO()
        qr.make_image(fill_color="black", back_color="white").save(qr_buffer, format="PNG")
        qr_buffer.seek(0)
        document = SimpleDocTemplate(
            output,
            pagesize=letter,
            rightMargin=0.7 * inch,
            leftMargin=0.7 * inch,
            topMargin=0.55 * inch,
            bottomMargin=0.65 * inch,
            title="Certificado de vacunación",
            author=settings.APP_NAME,
            subject="Certificado verificable de estado de vacunación",
            creator=f"{settings.APP_NAME} {settings.APP_VERSION}",
        )
        header = Table(
            [
                [
                    Paragraph(
                        settings.APP_NAME,
                        ParagraphStyle(
                            "Brand", parent=body, fontSize=13, textColor=navy, alignment=1
                        ),
                    )
                ]
            ],
            colWidths=[6.1 * inch],
        )
        header.setStyle(
            TableStyle(
                [
                    ("LINEBELOW", (0, 0), (-1, -1), 2, accent),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        details = Table(
            [
                [Paragraph("ESTUDIANTE", muted), Paragraph("ESTADO", muted)],
                [
                    Paragraph(escape(name), body),
                    Paragraph(
                        "CERTIFICABLE",
                        ParagraphStyle(
                            "Status", parent=body, textColor=colors.HexColor("#126B4A"), fontSize=13
                        ),
                    ),
                ],
                [Paragraph("EMITIDO", muted), Paragraph("VERSIÓN", muted)],
                [
                    Paragraph(
                        issued_at.astimezone(ZoneInfo("America/Bogota")).strftime(
                            "%d/%m/%Y %H:%M %Z"
                        ),
                        body,
                    ),
                    Paragraph("1", body),
                ],
            ],
            colWidths=[3.05 * inch, 3.05 * inch],
        )
        details.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F8FA")),
                    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D6E0E5")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D6E0E5")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        qr_image = Image(qr_buffer, width=1.35 * inch, height=1.35 * inch)
        verification_details = Paragraph(
            f"Identificador de certificado:<br/>{public_id}<br/><br/>"
            "Escanee el código QR o visite la URL para consultar su vigencia. "
            "La comprobación de vigencia no sustituye la verificación de integridad del archivo.<br/><br/>"
            f"Verificación pública:<br/>{escape(verify_url)}",
            muted,
        )
        signature_image = Image(io.BytesIO(signature_bytes), width=2.0 * inch, height=0.72 * inch)
        signer_profile = signer.profile
        signer_name = (
            " ".join(
                filter(
                    None,
                    [
                        getattr(signer_profile, "first_name", None),
                        getattr(signer_profile, "last_name", None),
                    ],
                )
            )
            or "Administrador"
        )
        signature_block = Table(
            [
                [signature_image],
                [Paragraph(escape(signer_name), body)],
                [
                    Paragraph(
                        escape(getattr(signer_profile, "job_title", None) or "Administrador"), muted
                    )
                ],
                [Paragraph("Firma visual del administrador emisor", muted)],
            ],
            colWidths=[2.5 * inch],
        )
        signature_block.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LINEABOVE", (0, 1), (0, 1), 0.6, colors.HexColor("#607D8B")),
                    ("TOPPADDING", (0, 1), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )
        body_content = [
            header,
            Spacer(1, 0.48 * inch),
            Paragraph("Certificado de estado de vacunación", title),
            Paragraph(
                "Constancia emitida tras la evaluación de certificabilidad realizada por el backend institucional.",
                ParagraphStyle("Intro", parent=body, alignment=1),
            ),
            Spacer(1, 0.35 * inch),
            details,
            Spacer(1, 0.38 * inch),
            Table([[qr_image, verification_details]], colWidths=[1.6 * inch, 4.95 * inch]),
            Spacer(1, 0.2 * inch),
            signature_block,
            Spacer(1, 0.15 * inch),
            Paragraph(
                f"{settings.APP_NAME} · Documento versión 1 · SHA-256 registrado para comprobación de integridad.",
                muted,
            ),
        ]

        def draw_page(canvas, doc):
            canvas.saveState()
            canvas.setStrokeColor(accent)
            canvas.setLineWidth(1)
            canvas.line(0.7 * inch, 0.48 * inch, 7.8 * inch, 0.48 * inch)
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.grey)
            canvas.drawString(
                0.7 * inch, 0.32 * inch, "Documento verificable · No es una firma digital"
            )
            canvas.drawRightString(7.8 * inch, 0.32 * inch, f"Página {doc.page}")
            canvas.restoreState()

        document.build(body_content, onFirstPage=draw_page, onLaterPages=draw_page)
        output.seek(0)
        return output
