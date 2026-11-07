"""Add private versioned administrator signature images to certificate records.

Revision ID: 2026_09_28_0300
Revises: 2026_09_28_0200
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "2026_09_28_0300"
down_revision = "2026_09_28_0200"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "certificate_signatures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("storage_key", name="uq_certificate_signatures_storage_key"),
    )
    op.create_index("ix_certificate_signatures_admin_id", "certificate_signatures", ["admin_id"])
    op.create_index(
        "ix_certificate_signatures_active", "certificate_signatures", ["admin_id", "is_active"]
    )
    op.add_column(
        "certificate_emissions",
        sa.Column("signature_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_certificate_emissions_signature_id_certificate_signatures",
        "certificate_emissions",
        "certificate_signatures",
        ["signature_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_certificate_emissions_signature_id", "certificate_emissions", ["signature_id"]
    )


def downgrade():
    raise RuntimeError(
        "Signature versions are associated with historical certificates; retain this additive schema."
    )
