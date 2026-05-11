"""Rate limiting configuration for ImmunoClinic."""

from slowapi import Limiter
from starlette.requests import Request


def _real_ip(request: Request) -> str:
    """Extract the real client IP, respecting Render/proxy X-Forwarded-For header."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_real_ip)
