"""Certificate module — thin HTTP router."""

from app.core.dependencies import get_current_active_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.modules.certificates.service import CertificateService
from app.modules.users.models import User
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.get("/scheme")
@limiter.limit("20/minute")
async def download_certificate(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the vaccination scheme certificate as PDF."""
    service = CertificateService(db)
    pdf_buffer = await service.generate_certificate(current_user.id)

    filename = f"certificado_vacunacion_{current_user.email.split('@')[0]}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
