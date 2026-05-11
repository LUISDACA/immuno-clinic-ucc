"""Reusable file validation utilities."""

from fastapi import UploadFile

from app.core.exceptions import BadRequestException

MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_PDF_MIME_TYPES = {"application/pdf"}
_PDF_MAGIC = b"%PDF-"


async def validate_pdf_file(upload_file: UploadFile) -> bytes:
    """Read and validate an uploaded PDF file.

    Checks MIME type, file size, and magic bytes.
    Returns the raw file bytes on success.
    Raises BadRequestException on any validation failure.
    """
    if upload_file.content_type not in ALLOWED_PDF_MIME_TYPES:
        raise BadRequestException(
            f"Tipo de archivo no permitido: {upload_file.filename}. Solo se permiten PDFs."
        )

    data = await upload_file.read()

    if len(data) > MAX_PDF_SIZE:
        raise BadRequestException(
            f"El archivo {upload_file.filename} excede el tamaño máximo de 10 MB"
        )

    if not data.startswith(_PDF_MAGIC):
        raise BadRequestException(f"El archivo {upload_file.filename} no parece ser un PDF válido")

    return data
