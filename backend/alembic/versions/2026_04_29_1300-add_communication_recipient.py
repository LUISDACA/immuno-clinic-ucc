"""Add direct communication recipient.

Revision ID: 2026_04_29_1300
Revises: 2026_04_29_1200
Create Date: 2026-04-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2026_04_29_1300"
down_revision: Union[str, None] = "2026_04_29_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "communication_threads",
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_communication_threads_recipient_id_users",
        "communication_threads",
        "users",
        ["recipient_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_communication_threads_recipient_id",
        "communication_threads",
        ["recipient_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_communication_threads_recipient_id", table_name="communication_threads")
    op.drop_constraint(
        "fk_communication_threads_recipient_id_users",
        "communication_threads",
        type_="foreignkey",
    )
    op.drop_column("communication_threads", "recipient_id")
