"""Add shared rate-limit counters."""

import sqlalchemy as sa
from alembic import op

revision = "2026_09_27_0300"
down_revision = "2026_09_27_0200"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "rate_limit_buckets",
        sa.Column("bucket_key", sa.String(64), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("reset_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rate_limit_buckets_reset_at", "rate_limit_buckets", ["reset_at"])


def downgrade():
    raise RuntimeError("Retain shared rate-limit history; use a compatible application rollback.")
