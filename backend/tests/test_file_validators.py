"""Unit tests for PDF file validation utilities."""

from unittest.mock import AsyncMock

import pytest
from app.core.exceptions import BadRequestException
from app.core.file_validators import MAX_PDF_SIZE, validate_pdf_file

_VALID_PDF_MAGIC = b"%PDF-1.4 fake pdf content"
_INVALID_MAGIC = b"PK\x03\x04 this is a zip"


def _make_upload(
    content: bytes,
    filename: str = "test.pdf",
    content_type: str = "application/pdf",
):
    mock = AsyncMock()
    mock.filename = filename
    mock.content_type = content_type
    mock.read = AsyncMock(return_value=content)
    return mock


class TestValidatePdfFile:
    @pytest.mark.asyncio
    async def test_valid_pdf_returns_bytes(self):
        upload = _make_upload(_VALID_PDF_MAGIC)
        result = await validate_pdf_file(upload)
        assert result == _VALID_PDF_MAGIC

    @pytest.mark.asyncio
    async def test_wrong_mime_type_raises(self):
        upload = _make_upload(_VALID_PDF_MAGIC, content_type="image/jpeg")
        with pytest.raises(BadRequestException, match="no permitido"):
            await validate_pdf_file(upload)

    @pytest.mark.asyncio
    async def test_octet_stream_mime_raises(self):
        upload = _make_upload(_VALID_PDF_MAGIC, content_type="application/octet-stream")
        with pytest.raises(BadRequestException):
            await validate_pdf_file(upload)

    @pytest.mark.asyncio
    async def test_file_too_large_raises(self):
        oversized = b"%PDF-" + b"x" * (MAX_PDF_SIZE + 1)
        upload = _make_upload(oversized)
        with pytest.raises(BadRequestException, match="tamaño máximo"):
            await validate_pdf_file(upload)

    @pytest.mark.asyncio
    async def test_wrong_magic_bytes_raises(self):
        upload = _make_upload(_INVALID_MAGIC)
        with pytest.raises(BadRequestException, match="no parece ser un PDF"):
            await validate_pdf_file(upload)

    @pytest.mark.asyncio
    async def test_empty_content_raises(self):
        upload = _make_upload(b"")
        with pytest.raises(BadRequestException):
            await validate_pdf_file(upload)

    @pytest.mark.asyncio
    async def test_exactly_at_max_size_is_accepted(self):
        at_limit = b"%PDF-" + b"a" * (MAX_PDF_SIZE - len(b"%PDF-"))
        upload = _make_upload(at_limit)
        result = await validate_pdf_file(upload)
        assert len(result) == MAX_PDF_SIZE

    @pytest.mark.asyncio
    async def test_error_message_includes_filename(self):
        upload = _make_upload(b"not pdf", filename="factura.pdf", content_type="text/plain")
        with pytest.raises(BadRequestException) as exc_info:
            await validate_pdf_file(upload)
        assert "factura.pdf" in str(exc_info.value.detail)
