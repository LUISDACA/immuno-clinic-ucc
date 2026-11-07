"""Add official evidence review states and unify legacy pending review states."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "2026_09_27_0400"
down_revision = "2026_09_27_0300"
branch_labels = None
depends_on = None


def upgrade():
    # Additive PostgreSQL enum extension. Legacy values stay available for old
    # evidence rows whose reviewed result cannot be inferred.
    op.execute("ALTER TYPE evidence_batch_status_enum ADD VALUE IF NOT EXISTS 'IN_REVIEW'")
    op.execute("ALTER TYPE evidence_batch_status_enum ADD VALUE IF NOT EXISTS 'APPROVED'")
    op.execute("ALTER TYPE evidence_batch_status_enum ADD VALUE IF NOT EXISTS 'DENIED'")

    op.add_column(
        "evidence_batches",
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
    )
    op.add_column(
        "evidence_batches",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_evidence_batches_reviewed_by_users",
        "evidence_batches",
        "users",
        ["reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "student_scheme_versions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=80), nullable=False),
        sa.Column("snapshot", JSONB(), nullable=False),
        sa.Column(
            "created_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "version_number", name="uq_student_scheme_version_number"),
    )
    op.create_index("ix_student_scheme_versions_user_id", "student_scheme_versions", ["user_id"])
    op.add_column(
        "vaccine_rules",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )

    # Pending is a historical spelling of the official review state. The
    # destination label already exists in both PostgreSQL enum types.
    op.execute(
        "UPDATE student_vaccine_doses SET status = 'IN_REVIEW' WHERE status = 'PENDING'"
    )
    op.execute("UPDATE student_vaccines SET status = 'IN_REVIEW' WHERE status = 'PENDING'")


def downgrade():
    raise RuntimeError(
        "Clinical status normalization is not safely reversible; retain the additive schema."
    )
