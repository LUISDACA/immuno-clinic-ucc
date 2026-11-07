"""Archive catalog assignments without deleting clinical records.

Revision ID: 2026_09_26_0100
Revises: 2026_05_07_0100
"""

import sqlalchemy as sa
from alembic import op

revision = "2026_09_26_0100"
down_revision = "2026_05_07_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("vaccine_dose_configs", "student_vaccines", "student_vaccine_doses"):
        op.add_column(
            table, sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False)
        )


def downgrade() -> None:
    # Removing archive markers would silently reactivate historical requirements.
    raise RuntimeError(
        "Forward-only safety migration: retain archive columns and deploy a compatible application revision."
    )
