"""Auth module — Pydantic schemas."""

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _validate_password_strength(v: str) -> str:
    errors = []
    if len(v) < 8:
        errors.append("al menos 8 caracteres")
    if not any(c.isupper() for c in v):
        errors.append("al menos una mayúscula")
    if not any(c.islower() for c in v):
        errors.append("al menos una minúscula")
    if not any(c.isdigit() for c in v):
        errors.append("al menos un número")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
        errors.append("al menos un símbolo (!@#$%...)")
    if errors:
        raise ValueError("La contraseña debe tener: " + ", ".join(errors))
    return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class MessageResponse(BaseModel):
    message: str
