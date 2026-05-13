"""Add extra student profile fields

Revision ID: 7c9d8f0a12b3
Revises: facc41711408
Create Date: 2026-04-24 16:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c9d8f0a12b3"
down_revision: Union[str, None] = "facc41711408"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("student_id", sa.String(length=50), nullable=True))
    op.add_column("profiles", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("profiles", sa.Column("eps_affiliation", sa.String(length=150), nullable=True))
    op.add_column("profiles", sa.Column("emergency_contact_name", sa.String(length=150), nullable=True))
    op.add_column("profiles", sa.Column("emergency_contact_phone", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "emergency_contact_phone")
    op.drop_column("profiles", "emergency_contact_name")
    op.drop_column("profiles", "eps_affiliation")
    op.drop_column("profiles", "birth_date")
    op.drop_column("profiles", "student_id")
