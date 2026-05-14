"""Integration tests for authentication module."""

import pytest
import pytest_asyncio
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService
from app.modules.users.models import User
from sqlalchemy.ext.asyncio import AsyncSession


class TestAuthService:
    """Tests for the AuthService login and token flows."""

    @pytest_asyncio.fixture
    def auth_service(self, db: AsyncSession) -> AuthService:
        return AuthService(AuthRepository(db))

    @pytest.mark.asyncio
    async def test_login_success(self, auth_service: AuthService, student_user: User):
        """Valid credentials return access and refresh tokens."""
        result = await auth_service.login("student@test.com", "Student123!")
        assert result.access_token
        assert result.refresh_token
        assert result.must_change_password is False

        # Verify the access token is valid
        payload = decode_access_token(result.access_token)
        assert payload is not None
        assert payload["sub"] == str(student_user.id)

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, auth_service: AuthService, student_user: User):
        """Wrong password raises Unauthorized."""
        from app.core.exceptions import UnauthorizedException

        with pytest.raises(UnauthorizedException):
            await auth_service.login("student@test.com", "WrongPassword!")

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, auth_service: AuthService):
        """Non-existent email raises Unauthorized."""
        from app.core.exceptions import UnauthorizedException

        with pytest.raises(UnauthorizedException):
            await auth_service.login("nobody@test.com", "Password123!")

    @pytest.mark.asyncio
    async def test_refresh_token_flow(self, auth_service: AuthService, student_user: User):
        """A valid refresh token produces a new access token."""
        tokens = await auth_service.login("student@test.com", "Student123!")
        result = await auth_service.refresh_access_token(tokens.refresh_token)
        assert result.access_token

        payload = decode_access_token(result.access_token)
        assert payload is not None
        assert payload["sub"] == str(student_user.id)

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_fails(
        self, auth_service: AuthService, student_user: User
    ):
        """Using an access token as a refresh token should fail."""
        from app.core.exceptions import UnauthorizedException

        tokens = await auth_service.login("student@test.com", "Student123!")
        with pytest.raises(UnauthorizedException):
            await auth_service.refresh_access_token(tokens.access_token)

    @pytest.mark.asyncio
    async def test_inactive_user_cannot_login(
        self, db: AsyncSession, auth_service: AuthService, student_user: User
    ):
        """Deactivated users should not be able to login."""
        from app.core.exceptions import InactiveUserException

        student_user.is_active = False
        await db.commit()

        with pytest.raises(InactiveUserException):
            await auth_service.login("student@test.com", "Student123!")

    @pytest.mark.asyncio
    async def test_login_reports_required_password_change(
        self,
        db: AsyncSession,
        auth_service: AuthService,
        student_user: User,
    ):
        """Login tells the client when a temporary password must be changed."""
        student_user.must_change_password = True
        await db.commit()

        result = await auth_service.login("student@test.com", "Student123!")

        assert result.must_change_password is True


class TestPasswordSecurity:
    """Tests for password hashing and verification."""

    def test_hash_is_not_plaintext(self):
        hashed = hash_password("MyPassword123!")
        assert hashed != "MyPassword123!"
        assert len(hashed) > 20

    def test_correct_password_verifies(self):
        hashed = hash_password("MyPassword123!")
        assert verify_password("MyPassword123!", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("MyPassword123!")
        assert not verify_password("WrongPassword!", hashed)

    def test_tokens_are_not_interchangeable(self):
        access = create_access_token({"sub": "test-user-id"})
        refresh = create_refresh_token({"sub": "test-user-id"})

        assert decode_access_token(access) is not None
        assert decode_access_token(refresh) is None
