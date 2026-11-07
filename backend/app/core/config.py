"""ImmunoClinic v2.0 — Core configuration via Pydantic BaseSettings."""

import logging
import warnings

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_INSECURE_KEY_MARKERS = {"change", "dev-", "secret", "example", "default", "insecure"}


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── JWT ───────────────────────────────────────────────────────────
    SECRET_KEY: str
    REFRESH_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTH_V1_ENABLED: bool = True  # Transitional; retire after supported clients use v2.

    # ── Storage ───────────────────────────────────────────────────────
    STORAGE_TYPE: str = "local"
    UPLOAD_DIR: str = "./uploads"
    S3_ENDPOINT: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_BUCKET: str | None = None

    # ── Email ─────────────────────────────────────────────────────────
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_TIMEOUT_SECONDS: float = 10.0
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@immunoclinic.local"
    SENDGRID_API_KEY: str | None = None
    EMAIL_ENABLED: bool = False

    # Push notifications
    FCM_ENABLED: bool = False
    FIREBASE_CREDENTIALS_PATH: str | None = None
    FIREBASE_CREDENTIALS_JSON: str | None = None
    VACCINE_REMINDER_ENABLED: bool = True
    VACCINE_REMINDER_INTERVAL_SECONDS: int = 86400
    VACCINE_EMAIL_REMINDER_DAYS: str = "3,2,1,0"
    CRON_SECRET: str | None = None

    # ── App ───────────────────────────────────────────────────────────
    APP_NAME: str = "ImmunoClinic"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"
    CERTIFICATE_VERIFY_BASE_URL: str | None = None
    PASSWORD_RESET_URL_BASE: str | None = None
    APP_DEEP_LINK_BASE: str = "immunoclinic://auth"
    ANDROID_PACKAGE_NAME: str = "com.immunoclinic.immuno_clinic_app"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:5173",
    ]
    CORS_ORIGIN_REGEX: str | None = None

    # ── Rate Limiting ─────────────────────────────────────────────────
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_FORGOT_PASSWORD: str = "3/minute"
    TRUSTED_PROXY_CIDRS: list[str] = []

    # ── Logging ───────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # Seeded administrator
    ADMIN_EMAIL: str = "admin@immunoclinic.dev"
    ADMIN_PASSWORD: str | None = None
    ADMIN_FIRST_NAME: str = "Admin"
    ADMIN_LAST_NAME: str = "ImmunoClinic"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Accept JSON array, CSV ("a,b,c"), wildcard ("*") or list."""
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                return []
            if stripped == "*":
                return ["*"]
            # JSON array
            if stripped.startswith("["):
                import json

                return json.loads(stripped)
            # CSV fallback
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return v

    @field_validator("TRUSTED_PROXY_CIDRS", mode="before")
    @classmethod
    def parse_trusted_proxy_cidrs(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value or not value.strip():
            return []
        if value.lstrip().startswith("["):
            import json

            return json.loads(value)
        return [item.strip() for item in value.split(",") if item.strip()]

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: str | bool) -> bool:
        if isinstance(v, str):
            normalized = v.strip().lower()
            if normalized in {"1", "true", "yes", "debug", "dev", "development"}:
                return True
            if normalized in {"0", "false", "no", "release", "prod", "production"}:
                return False
        return v

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        """Warn or fail when running production with insecure defaults."""
        if self.DEBUG:
            return self

        # Check for insecure secret keys in production
        for key_name in ("SECRET_KEY", "REFRESH_SECRET_KEY"):
            value = getattr(self, key_name).lower()
            if any(marker in value for marker in _INSECURE_KEY_MARKERS):
                raise ValueError(
                    f"{key_name} appears to use an insecure default value. "
                    f"Set a strong random key before deploying to production."
                )

        # Warn about wildcard CORS in production
        if "*" in self.CORS_ORIGINS:
            warnings.warn(
                "CORS_ORIGINS contains '*' in production mode. "
                "This allows ANY origin to make authenticated requests. "
                "Set specific origins in CORS_ORIGINS.",
                stacklevel=2,
            )

        return self


settings = Settings()
