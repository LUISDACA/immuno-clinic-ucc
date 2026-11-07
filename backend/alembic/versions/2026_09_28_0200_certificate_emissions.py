"""Additive certificate issuance records.

Revision ID: 2026_09_28_0200
Revises: 2026_09_28_0100
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "2026_09_28_0200"
down_revision = "2026_09_28_0100"
branch_labels = None
depends_on = None


def upgrade():
    status = sa.Enum("ISSUED", "REVOKED", name="certificate_status_enum")
    op.create_table(
        "certificate_emissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("public_id", sa.String(64), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("document_sha256", sa.String(64), nullable=False),
        sa.Column("certificate_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revocation_reason", sa.String(500), nullable=True),
        sa.Column("revoked_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["revoked_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_certificate_emissions_public_id", "certificate_emissions", ["public_id"], unique=True)
    op.create_index("ix_certificate_emissions_user_id", "certificate_emissions", ["user_id"])


def downgrade():
    raise RuntimeError("Issued certificates are historical records; retain the additive schema.")
