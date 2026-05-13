"""Add application admin role and campus scope.

Revision ID: 2026_04_29_1200
Revises: 2026_04_28_1400
Create Date: 2026-04-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2026_04_29_1200"
down_revision: Union[str, None] = "2026_04_28_1400"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'APP_ADMIN'")
    op.add_column("profiles", sa.Column("campus", sa.String(length=150), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "campus")
    # PostgreSQL cannot remove enum values without recreating the enum safely.
