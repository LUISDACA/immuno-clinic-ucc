"""ImmunoClinic v2.0 — FastAPI application entry point."""

import asyncio
import html
import logging
import time
import uuid
from contextlib import asynccontextmanager, suppress
from urllib.parse import quote

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging_config import configure_logging
from app.core.rate_limit import limiter
from app.core.request_context import request_id_var
from app.db.seed import seed_admin_user, seed_vaccines
from app.db.session import AsyncSessionLocal, get_db
from app.modules.admin.router import router as admin_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.repository import AuthRepository

# Import all routers
from app.modules.auth.router import router as auth_router
from app.modules.certificates.router import router as certificates_router
from app.modules.communications.router import router as communications_router
from app.modules.evidence.router import router as evidence_router
from app.modules.notifications.router import router as notifications_router
from app.modules.notifications.vaccine_due import run_vaccine_due_reminder_loop
from app.modules.users.router import router as users_router
from app.modules.vaccination_scheme.router import router as scheme_router

configure_logging(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — run seeds on startup."""
    async with AsyncSessionLocal() as session:
        await seed_vaccines(session)
        await seed_admin_user(session)
        deleted = await AuthRepository(session).delete_expired_tokens()
        await session.commit()
        if deleted:
            logger.info("Purged %d expired/revoked refresh tokens", deleted)
    reminder_task = None
    if settings.VACCINE_REMINDER_ENABLED:
        reminder_task = asyncio.create_task(run_vaccine_due_reminder_loop())
    yield
    if reminder_task is not None:
        reminder_task.cancel()
        with suppress(asyncio.CancelledError):
            await reminder_task


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API para el control del esquema de vacunación de estudiantes universitarios",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Attach limiter state so route decorators work
app.state.limiter = limiter


# ── Rate limit error handler ─────────────────────────────────────────
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiados intentos. Intenta de nuevo más tarde."},
    )


# ── Security headers middleware ───────────────────────────────────────
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
    )
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Request logging middleware ────────────────────────────────────────
_SILENT_PATHS = {"/", "/docs", "/redoc", "/openapi.json"}


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    rid = uuid.uuid4().hex[:8]
    request_id_var.set(rid)

    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    response.headers["X-Request-ID"] = rid

    if request.url.path not in _SILENT_PATHS:
        status = response.status_code
        extra = {
            "method": request.method,
            "path": request.url.path,
            "status": status,
            "duration_ms": round(elapsed_ms),
        }
        if status >= 500:
            logger.error("%s %s → %s", request.method, request.url.path, status, extra=extra)
        elif elapsed_ms > 1000:
            logger.warning(
                "SLOW %s %s → %s (%.0fms)",
                request.method,
                request.url.path,
                status,
                elapsed_ms,
                extra=extra,
            )
        else:
            logger.info("%s %s → %s", request.method, request.url.path, status, extra=extra)

    return response


# ── CORS ──────────────────────────────────────────────────────────────
# La spec de CORS prohíbe `allow_origins=["*"]` con `allow_credentials=True`.
# Si configuran wildcard, usamos `allow_origin_regex=".*"` que sí es compatible.
_cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "Accept"],
}
if "*" in settings.CORS_ORIGINS:
    _cors_kwargs["allow_origin_regex"] = ".*"
else:
    _cors_kwargs["allow_origins"] = settings.CORS_ORIGINS
    if settings.CORS_ORIGIN_REGEX:
        _cors_kwargs["allow_origin_regex"] = settings.CORS_ORIGIN_REGEX

app.add_middleware(CORSMiddleware, **_cors_kwargs)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Register routers ─────────────────────────────────────────────────
API_V1 = "/api/v1"

app.include_router(auth_router, prefix=API_V1)
app.include_router(users_router, prefix=API_V1)
app.include_router(scheme_router, prefix=API_V1)
app.include_router(evidence_router, prefix=API_V1)
app.include_router(notifications_router, prefix=API_V1)
app.include_router(admin_router, prefix=API_V1)
app.include_router(certificates_router, prefix=API_V1)
app.include_router(audit_router, prefix=API_V1)
app.include_router(communications_router, prefix=API_V1)


@app.get("/", tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check — verifies DB connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "db": "unreachable",
                "app": settings.APP_NAME,
                "version": settings.APP_VERSION,
            },
        )
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


def _is_android(user_agent: str) -> bool:
    """Heuristic UA check: only mobile Android browsers / WebViews."""
    if not user_agent:
        return False
    ua = user_agent.lower()
    return "android" in ua and "mobile" in ua


@app.get("/reset-password", response_class=HTMLResponse, include_in_schema=False)
async def reset_password_deep_link(request: Request, token: str = ""):
    """Route the reset link to the right place depending on the device.

    - Android phones → open the installed APK via deep link.
    - Anything else (desktop, iOS, …) → redirect to the web frontend.
    """
    encoded_token = quote(token, safe="")
    user_agent = request.headers.get("user-agent", "")

    web_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={encoded_token}"

    # Web (desktop/iOS/etc.): redirigir directo al frontend Next.js
    if not _is_android(user_agent):
        return RedirectResponse(url=web_link, status_code=302)

    # Android: intent link para abrir la APK + fallback al navegador
    app_link = f"{settings.APP_DEEP_LINK_BASE.rstrip('/')}/reset-password?token={encoded_token}"
    intent_target = app_link.removeprefix("immunoclinic://")
    intent_link = (
        f"intent://{intent_target}#Intent;"
        f"scheme=immunoclinic;"
        f"package={settings.ANDROID_PACKAGE_NAME};"
        "end"
    )
    escaped_intent_link = html.escape(intent_link, quote=True)
    escaped_web_link = html.escape(web_link, quote=True)

    return HTMLResponse(
        f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restablecer contrase&ntilde;a - ImmunoClinic</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
      background: #f4f7fb;
    }}
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    main {{
      width: min(440px, 100%);
      background: #ffffff;
      border: 1px solid #dfe7f3;
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 14px 42px rgba(25, 42, 70, 0.12);
    }}
    h1 {{
      margin: 0 0 12px;
      font-size: 24px;
      line-height: 1.2;
    }}
    p {{
      margin: 0 0 16px;
      color: #526072;
      line-height: 1.5;
    }}
    a.button {{
      display: inline-flex;
      justify-content: center;
      width: 100%;
      box-sizing: border-box;
      padding: 14px 18px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 700;
      margin-bottom: 10px;
    }}
    a.primary {{
      background: #1456a0;
      color: #ffffff;
    }}
    a.secondary {{
      background: #ffffff;
      color: #1456a0;
      border: 1px solid #1456a0;
    }}
    small {{
      display: block;
      margin-top: 14px;
      color: #738198;
      line-height: 1.4;
    }}
  </style>
</head>
<body>
  <main>
    <h1>Restablecer contrase&ntilde;a</h1>
    <p>Si ImmunoClinic no se abre autom&aacute;ticamente, toca el bot&oacute;n.</p>
    <a class="button primary" href="{escaped_intent_link}">Abrir aplicaci&oacute;n</a>
    <a class="button secondary" href="{escaped_web_link}">Abrir en el navegador</a>
    <small>Si no tienes la APK instalada, usa la opci&oacute;n del navegador.</small>
  </main>
  <script>
    setTimeout(function () {{
      window.location.href = "{escaped_intent_link}";
    }}, 500);
  </script>
</body>
</html>"""
    )
