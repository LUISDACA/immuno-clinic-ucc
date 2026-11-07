"""Add explicit certificate signer assignments and retain ambiguity report.

Revision ID: 2026_09_28_0400
Revises: 2026_09_28_0300
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "2026_09_28_0400"
down_revision = "2026_09_28_0300"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "certificate_signer_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("program", sa.String(150), nullable=False),
        sa.Column("campus", sa.String(150), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index(
        "uq_certificate_signer_assignments_active_scope",
        "certificate_signer_assignments",
        ["program", "campus"],
        unique=True,
        postgresql_where=sa.text("active IS TRUE"),
    )
    op.create_index(
        "ix_certificate_signer_assignments_admin_id",
        "certificate_signer_assignments",
        ["admin_id"],
    )

    # Preserve a report of ambiguous legacy scopes. No assignment is inferred.
    op.create_table(
        "certificate_signer_assignment_conflicts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("program", sa.String(150), nullable=False),
        sa.Column("campus", sa.String(150), nullable=False),
        sa.Column("admin_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "detected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "uq_certificate_signer_assignment_conflict_scope",
        "certificate_signer_assignment_conflicts",
        ["program", "campus"],
        unique=True,
    )
    bind = op.get_bind()
    ambiguous_scopes = bind.execute(
        sa.text(
            "SELECT p.program, p.campus, array_agg(u.id::text ORDER BY u.id::text) AS admin_ids "
            "FROM users u JOIN profiles p ON p.user_id = u.id "
            "WHERE u.role = 'ADMIN' AND u.is_active IS TRUE "
            "AND p.program IS NOT NULL AND p.campus IS NOT NULL "
            "GROUP BY p.program, p.campus HAVING count(*) > 1"
        )
    ).mappings()
    for conflict in ambiguous_scopes:
        bind.execute(
            sa.text(
                "INSERT INTO certificate_signer_assignment_conflicts "
                "(id, program, campus, admin_ids) "
                "VALUES (:id, :program, :campus, CAST(:admin_ids AS jsonb))"
            ),
            {
                "id": str(uuid4()),
                "program": conflict["program"],
                "campus": conflict["campus"],
                "admin_ids": json.dumps(conflict["admin_ids"]),
            },
        )

    op.add_column(
        "certificate_emissions",
        sa.Column("signer_admin_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_certificate_emissions_signer_admin_id_users",
        "certificate_emissions",
        "users",
        ["signer_admin_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_certificate_emissions_signer_admin_id", "certificate_emissions", ["signer_admin_id"]
    )
    op.add_column(
        "certificate_emissions",
        sa.Column("signer_assignment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_certificate_emissions_signer_assignment_id",
        "certificate_emissions",
        "certificate_signer_assignments",
        ["signer_assignment_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_certificate_emissions_signer_assignment_id",
        "certificate_emissions",
        ["signer_assignment_id"],
    )


def downgrade():
    raise RuntimeError(
        "Signer assignments and historical certificate references are retained; migration is additive."
    )
