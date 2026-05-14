"""Integration tests for CertificateService."""

from __future__ import annotations

import io
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.common.enums import AppliesTo, DoseStatus, DoseType, VaccineStatus
from app.core.exceptions import BadRequestException
from app.modules.certificates.service import CertificateService
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig
from dateutil.relativedelta import relativedelta
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
            applied_date=first_applied_date or date.today(),
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
    async def test_raises_when_first_dose_is_missing(self, db: AsyncSession, student_user):
        service = CertificateService(db)

        fake_sv = MagicMock()
        fake_sv.doses = []
        fake_sv.vaccine = MagicMock()
        fake_sv.vaccine.name = "Hepatitis B"
        fake_sv.vaccine.has_titer = False

        service.scheme_service.get_student_scheme = AsyncMock(return_value=[fake_sv])

        with pytest.raises(BadRequestException, match="primera dosis"):
            await service.generate_certificate(student_user.id)

    @pytest.mark.asyncio
    async def test_raises_when_due_date_is_overdue(self, db: AsyncSession, student_user):
        service = CertificateService(db)
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[
                _certificate_vaccine(first_applied_date=date.today() - relativedelta(months=2))
            ]
        )

        with pytest.raises(BadRequestException, match="plazo vencido"):
            await service.generate_certificate(student_user.id)


class TestCertificateServicePdf:
    @pytest.mark.asyncio
    async def test_returns_bytes_io_when_first_doses_are_current(
        self, db: AsyncSession, student_user
    ):
        service = CertificateService(db)
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=date.today())]
        )

        result = await service.generate_certificate(student_user.id)

        assert isinstance(result, io.BytesIO)

    @pytest.mark.asyncio
    async def test_pdf_starts_with_pdf_magic_bytes(self, db: AsyncSession, student_user):
        service = CertificateService(db)
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=date.today())]
        )

        buf = await service.generate_certificate(student_user.id)
        content = buf.read()

        assert content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_pdf_is_non_empty(self, db: AsyncSession, student_user):
        service = CertificateService(db)
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=date.today())]
        )

        buf = await service.generate_certificate(student_user.id)

        assert len(buf.read()) > 0

    @pytest.mark.asyncio
    async def test_buffer_is_rewound_to_start(self, db: AsyncSession, student_user):
        service = CertificateService(db)
        service.scheme_service.get_student_scheme = AsyncMock(
            return_value=[_certificate_vaccine(first_applied_date=date.today())]
        )

        buf = await service.generate_certificate(student_user.id)

        assert buf.tell() == 0


class TestCertificateVaccineComplete:
    """Unit tests for certificate completion rules via mock objects."""

    def _make_vaccine(self, *, has_titer: bool = False, doses: list = None):
        sv = MagicMock()
        sv.vaccine = MagicMock()
        sv.vaccine.has_titer = has_titer
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
