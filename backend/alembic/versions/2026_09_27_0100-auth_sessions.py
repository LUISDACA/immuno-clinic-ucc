"""Add session families and private BFF storage; preserve legacy token rows."""

import sqlalchemy as sa
from alembic import op

revision = "2026_09_27_0100"
down_revision = "2026_09_26_0100"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users", sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0")
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("protocol_version", sa.Integer(), nullable=False),
        sa.Column("auth_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("revocation_reason", sa.String(40)),
        sa.CheckConstraint(
            "status IN ('ACTIVE','REVOKED','COMPROMISED')", name="ck_session_status"
        ),
        sa.CheckConstraint("protocol_version IN (1,2)", name="ck_session_protocol"),
    )
    for col in ("user_id", "expires_at"):
        op.create_index(f"ix_auth_sessions_{col}", "auth_sessions", [col])
    op.add_column(
        "refresh_tokens",
        sa.Column("session_id", sa.UUID(), sa.ForeignKey("auth_sessions.id", ondelete="CASCADE")),
    )
    op.add_column(
        "refresh_tokens", sa.Column("generation", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column("refresh_tokens", sa.Column("consumed_at", sa.DateTime(timezone=True)))
    op.add_column("refresh_tokens", sa.Column("replaced_by_id", sa.UUID()))
    op.create_index("ix_refresh_tokens_session_id", "refresh_tokens", ["session_id"])
    op.create_unique_constraint(
        "uq_refresh_generation", "refresh_tokens", ["session_id", "generation"]
    )
    op.create_index(
        "uq_refresh_current",
        "refresh_tokens",
        ["session_id"],
        unique=True,
        postgresql_where=sa.text(
            "consumed_at IS NULL AND revoked = false AND session_id IS NOT NULL"
        ),
    )
    op.create_table(
        "web_sessions",
        sa.Column("cookie_hash", sa.String(64), primary_key=True),
        sa.Column("auth_session_id", sa.UUID(), nullable=False),
        sa.Column("encrypted_tokens", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
    )
    for col in ("auth_session_id", "expires_at"):
        op.create_index(f"ix_web_sessions_{col}", "web_sessions", [col])


def downgrade():
    raise RuntimeError("Retain security history; roll back only to a session-aware application.")
