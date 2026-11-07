"""Bind FCM registrations to revocable sessions without deleting legacy rows."""

import sqlalchemy as sa
from alembic import op

revision = "2026_09_27_0200"
down_revision = "2026_09_27_0100"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "device_tokens",
        sa.Column("session_id", sa.UUID(), sa.ForeignKey("auth_sessions.id", ondelete="CASCADE")),
    )
    op.create_index("ix_device_tokens_session_id", "device_tokens", ["session_id"])


def downgrade():
    raise RuntimeError("Retain device session bindings; use a compatible application rollback.")
