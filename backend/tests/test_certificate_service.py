"""Integration tests for CertificateService."""

from __future__ import annotations

import hashlib
import io
import shutil
import subprocess
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.common.enums import AppliesTo, DoseStatus, DoseType, VaccineStatus
from app.core.exceptions import BadRequestException, CertificateNotEligibleException
from app.modules.certificates.models import CertificateEmission, CertificateStatus
from app.modules.certificates.service import CertificateService
from app.modules.certificates.signature_service import CertificateSignatureService
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccination_scheme.rules import clinical_today
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig, VaccineRule
from dateutil.relativedelta import relativedelta
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _dose_config(
    *,
    vaccine_id: uuid.UUID,
    dose_number: int,
    label: str,
    is_required: bool = True,
    dose_type: DoseType = DoseType.STANDARD,
) -> VaccineDoseConfig:
    return VaccineDoseConfig(
        id=uuid.uuid4(),
        vaccine_id=vaccine_id,
        dose_number=dose_number,
        label=label,
        is_required=is_required,
        applies_to=AppliesTo.ALL,
        dose_type=dose_type,
    )


def _certificate_vaccine(
    *,
    first_applied_date: date | None = None,
    second_applied_date: date | None = None,
    second_status: DoseStatus = DoseStatus.PENDING,
) -> StudentVaccine:
    vaccine = Vaccine(
        id=uuid.uuid4(),
        name="Hepatitis B",
        code="HEP_B",
        base_doses=3,
        has_booster=False,
        has_titer=True,
        has_titer_value=False,
        is_annual=False,
        applies_to=AppliesTo.ALL,
        is_active=True,
        display_order=1,
    )
    vaccine.rules = [
        VaccineRule(
            vaccine_id=vaccine.id,
            rule_type="schedule",
            rule_config={"intervals": [{"from_dose": 1, "to_dose": 2, "months": 1}]},
            description="test schedule",
        )
    ]
    first_config = _dose_config(
        vaccine_id=vaccine.id,
        dose_number=1,
        label="Primera dosis",
    )
    second_config = _dose_config(
        vaccine_id=vaccine.id,
        dose_number=2,
        label="Segunda dosis",
    )
    student_vaccine = StudentVaccine(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        vaccine_id=vaccine.id,
        vaccine=vaccine,
        status=VaccineStatus.PENDING,
    )
    doses = [
        StudentVaccineDose(
            id=uuid.uuid4(),
            student_vaccine_id=student_vaccine.id,
            dose_config_id=first_config.id,
            dose_number=1,
            dose_config=first_config,
            status=DoseStatus.APPROVED,
            applied_date=first_applied_date or clinical_today(),
        ),
        StudentVaccineDose(
            id=uuid.uuid4(),
            student_vaccine_id=student_vaccine.id,
            dose_config_id=second_config.id,
            dose_number=2,
            dose_config=second_config,
            status=second_status,
            applied_date=second_applied_date,
        ),
    ]
    student_vaccine.doses = doses
    for dose in doses:
        dose.student_vaccine = student_vaccine
    return student_vaccine


class TestCertificateServiceErrors:
    @pytest.mark.asyncio
    async def test_raises_when_user_not_found(self, db: AsyncSession):
        service = CertificateService(db)
        with pytest.raises(BadRequestException, match="no encontrado"):
            await service.generate_certificate(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_raises_when_first_dose_is_missing(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        service, _, _ = signed_certificate_service
        incomplete = _certificate_vaccine()
        incomplete.doses[0].status = DoseStatus.IN_REVIEW
        incomplete.doses[0].applied_date = None
        service.scheme_service.get_student_scheme = AsyncMock(return_value=[incomplete])

        with pytest.raises(CertificateNotEligibleException):
            await service.generate_certificate(student_user.id)

    @pytest.mark.asyncio
    async def test_raises_when_due_date_is_overdue(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        service, _, _ = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[
                _certificate_vaccine(first_applied_date=clinical_today() - relativedelta(months=2))
            ]
        )

        with pytest.raises(CertificateNotEligibleException):
            await service.generate_certificate(student_user.id)


class TestCertificateServicePdf:
    @pytest.mark.asyncio
    async def test_returns_bytes_io_when_first_doses_are_current(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        service, _, _ = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )

        result = await service.generate_certificate(student_user.id)

        assert isinstance(result, io.BytesIO)

    @pytest.mark.asyncio
    async def test_pdf_starts_with_pdf_magic_bytes(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        service, _, _ = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )

        buf = await service.generate_certificate(student_user.id)
        content = buf.read()

        assert content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_pdf_is_non_empty(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        service, _, _ = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )

        buf = await service.generate_certificate(student_user.id)

        assert len(buf.read()) > 0

    @pytest.mark.asyncio
    async def test_buffer_is_rewound_to_start(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        service, _, _ = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )

        buf = await service.generate_certificate(student_user.id)

        assert buf.tell() == 0

    @pytest.mark.asyncio
    async def test_issuance_persists_exact_pdf_hash_and_minimizes_content(
        self, db: AsyncSession, student_user, signed_certificate_service, tmp_path
    ):
        service, signer, storage = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )

        issued = await service.issue_certificate(student_user.id)
        pdf_bytes = issued.pdf.getvalue()
        assert issued.emission.status is CertificateStatus.ISSUED
        assert issued.emission.signature_id is not None
        assert issued.emission.signer_admin_id == signer.id
        assert issued.emission.signer_assignment_id is not None
        assert issued.emission.document_sha256 == hashlib.sha256(pdf_bytes).hexdigest()
        assert len(issued.emission.public_id) == 43
        assert b"/Subtype /Image" in pdf_bytes
        assert pdf_bytes.count(b"/Subtype /Image") >= 2  # QR plus administrator signature.
        assert (
            await db.execute(select(CertificateEmission))
        ).scalars().one().id == issued.emission.id

        if shutil.which("pdfinfo"):
            metadata = subprocess.run(
                ["pdfinfo", "-"], input=pdf_bytes, capture_output=True, check=True
            ).stdout.decode()
            assert "Title:           Certificado de vacunación" in metadata
            assert "Author:          ImmunoClinic" in metadata
            assert "Pages:           1" in metadata

        if shutil.which("pdftotext"):
            text = subprocess.run(
                ["pdftotext", "-", "-"], input=pdf_bytes, capture_output=True, check=True
            ).stdout.decode()
            assert f"/verify/{issued.emission.public_id}" in "".join(text.split())
            assert "Test Student" in text
            assert "student@test.com" not in text
            assert "12345678" not in text
            assert "STU001" not in text
            assert "Medicina" not in text
            assert "Hepatitis B" not in text
            assert "Página 1" in text
            assert "Synthetic Signer" in text
            assert "Firma visual del administrador emisor" in text
        if shutil.which("pdfimages"):
            pdf_path = tmp_path / "certificate.pdf"
            output_prefix = tmp_path / "embedded"
            pdf_path.write_bytes(pdf_bytes)
            subprocess.run(
                ["pdfimages", "-png", str(pdf_path), str(output_prefix)],
                capture_output=True,
                check=True,
            )
            extracted = list(tmp_path.glob("embedded-*.png"))
            assert len(extracted) >= 2
            expected_image = Image.open(io.BytesIO(next(iter(storage.files.values()))))
            expected_pixel = expected_image.getpixel((0, 0))
            extracted_images = [Image.open(path).convert("RGBA") for path in extracted]
            assert any(
                image.size == expected_image.size and image.getpixel((0, 0)) == expected_pixel
                for image in extracted_images
            )

    @pytest.mark.asyncio
    async def test_missing_responsible_signature_returns_stable_conflict_without_emission(
        self, db: AsyncSession, student_user, signed_certificate_service
    ):
        from app.core.exceptions import CertificateSignerException
        from app.modules.certificates.models import CertificateSignature

        service, signer, _ = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )
        signature = await db.scalar(
            select(CertificateSignature).where(CertificateSignature.admin_id == signer.id)
        )
        await db.delete(signature)
        await db.commit()

        with pytest.raises(CertificateSignerException) as error:
            await service.issue_certificate(student_user.id)

        assert error.value.code == "CERTIFICATE_SIGNER_SIGNATURE_MISSING"
        assert (await db.execute(select(CertificateEmission))).scalars().all() == []

    @pytest.mark.asyncio
    async def test_signature_replacement_never_changes_historical_certificate(
        self, db: AsyncSession, student_user, signed_certificate_service, tmp_path
    ):
        service, signer, storage = signed_certificate_service
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=clinical_today())]
        )
        first = await service.issue_certificate(student_user.id)
        first_pdf = first.pdf.getvalue()
        first_hash = first.emission.document_sha256
        first_signature_id = first.emission.signature_id

        replacement_image = Image.new("RGBA", (80, 30), (240, 20, 30, 255))
        replacement_buffer = io.BytesIO()
        replacement_image.save(replacement_buffer, format="PNG")
        replacement = await CertificateSignatureService(db, storage).upload(
            signer, replacement_buffer.getvalue(), "image/png"
        )
        second = await service.issue_certificate(student_user.id)

        assert second.emission.signature_id == replacement.id
        assert second.emission.signature_id != first_signature_id
        assert first.emission.document_sha256 == first_hash
        assert hashlib.sha256(first_pdf).hexdigest() == first_hash
        assert first_signature_id is not None
        assert first.emission.signature_id == first_signature_id
        assert second.emission.document_sha256 != first_hash
        assert len(storage.files) == 2
        if shutil.which("pdfimages"):
            expected = [
                ((64, 24), (10, 40, 80)),
                ((80, 30), (240, 20, 30)),
            ]
            for index, (pdf_bytes, (size, pixel)) in enumerate(
                [(first_pdf, expected[0]), (second.pdf.getvalue(), expected[1])]
            ):
                pdf_path = tmp_path / f"version-{index}.pdf"
                output_prefix = tmp_path / f"version-{index}-image"
                pdf_path.write_bytes(pdf_bytes)
                subprocess.run(
                    ["pdfimages", "-png", str(pdf_path), str(output_prefix)],
                    capture_output=True,
                    check=True,
                )
                extracted = [
                    Image.open(path).convert("RGB")
                    for path in tmp_path.glob(f"version-{index}-image-*.png")
                ]
                assert any(
                    image.size == size and image.getpixel((0, 0)) == pixel for image in extracted
                )


class TestCertificateVaccineComplete:
    """Unit tests for certificate completion rules via mock objects."""

    def _make_vaccine(self, *, has_titer: bool = False, doses: list = None):
        sv = MagicMock()
        sv.vaccine = MagicMock()
        sv.vaccine.has_titer = has_titer
        sv.vaccine.is_annual = False
        sv.vaccine.rules = []
        sv.doses = doses or []
        return sv

    def _make_approved_dose(self, *, is_titer: bool = False):
        dose = MagicMock()
        dose.status = DoseStatus.APPROVED
        dose.dose_config = MagicMock()
        dose.dose_config.is_required = True
        dose.dose_config.dose_type = DoseType.TITER if is_titer else DoseType.STANDARD
        return dose

    def test_empty_doses_no_titer_is_not_complete(self):
        from app.modules.vaccination_scheme.rules import certificate_vaccine_complete

        sv = self._make_vaccine(has_titer=False, doses=[])
        assert certificate_vaccine_complete(sv) is False

    def test_all_required_doses_approved_is_complete(self):
        from app.modules.vaccination_scheme.rules import certificate_vaccine_complete

        dose = MagicMock()
        dose.status = DoseStatus.APPROVED
        dose.dose_config = MagicMock()
        dose.dose_config.is_required = True
        dose.dose_config.dose_type = DoseType.STANDARD

        sv = self._make_vaccine(doses=[dose])
        assert certificate_vaccine_complete(sv) is True
