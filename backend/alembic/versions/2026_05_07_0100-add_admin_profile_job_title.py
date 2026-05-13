"""add admin profile job title

Revision ID: 2026_05_07_0100
Revises: 2026_05_06_1000
Create Date: 2026-05-07 01:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "2026_05_07_0100"
down_revision = "2026_05_06_1000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("job_title", sa.String(length=150), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "job_title")
