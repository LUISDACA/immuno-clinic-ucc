"""Auth module — repository for DB operations."""

import uuid
from datetime import datetime, timezone

from app.modules.auth.models import PasswordResetToken, RefreshToken
from app.modules.users.models import User
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession


class AuthRepository:
    """Data access for auth-related operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> User | None:
        normalized_email = email.strip().lower()
        result = await self.db.execute(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def update_password(
        self,
        user_id: uuid.UUID,
        hashed_password: str,
        *,
        must_change_password: bool = False,
    ) -> None:
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                hashed_password=hashed_password,
                must_change_password=must_change_password,
                updated_at=datetime.now(timezone.utc),
            )
        )

    async def create_reset_token(
        self, user_id: uuid.UUID, token_hash: str, expires_at: datetime
    ) -> PasswordResetToken:
        token = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            used=False,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_valid_reset_token(self, token_hash: str) -> PasswordResetToken | None:
        result = await self.db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used.is_(False),
                PasswordResetToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def mark_token_used(self, token_id: uuid.UUID) -> None:
        await self.db.execute(
            update(PasswordResetToken).where(PasswordResetToken.id == token_id).values(used=True)
        )

    async def create_refresh_token(
        self, user_id: uuid.UUID, token_hash: str, expires_at: datetime
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked=False,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_valid_refresh_token(self, token_hash: str) -> RefreshToken | None:
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked.is_(False),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token_id: uuid.UUID) -> None:
        await self.db.execute(
            update(RefreshToken).where(RefreshToken.id == token_id).values(revoked=True)
        )

    async def revoke_all_user_tokens(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .values(revoked=True)
        )

    async def delete_expired_tokens(self) -> int:
        """Delete revoked or expired refresh tokens. Returns number of rows deleted."""
        result = await self.db.execute(
            delete(RefreshToken).where(
                (RefreshToken.revoked.is_(True))
                | (RefreshToken.expires_at <= datetime.now(timezone.utc))
            )
        )
        return result.rowcount
