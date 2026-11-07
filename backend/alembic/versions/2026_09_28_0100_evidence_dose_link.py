"""Add an optional dose association to evidence batches.

Revision ID: 2026_09_28_0100
Revises: 2026_09_27_0400
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "2026_09_28_0100"
down_revision = "2026_09_27_0400"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidence_batches",
        sa.Column("dose_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_evidence_batches_dose_id_student_vaccine_doses",
        "evidence_batches",
        "student_vaccine_doses",
        ["dose_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_evidence_batches_dose_id", "evidence_batches", ["dose_id"])


def downgrade():
    raise RuntimeError(
        "Evidence dose associations are historical data; retain the additive schema."
    )
