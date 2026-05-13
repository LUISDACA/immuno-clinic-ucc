"""Add communications

Revision ID: add_communications
Revises: 7c9d8f0a12b3
Create Date: 2026-04-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "add_communications"
down_revision: Union[str, None] = "7c9d8f0a12b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status_enum') THEN
                CREATE TYPE conversation_status_enum AS ENUM ('OPEN', 'CLOSED');
            END IF;
        END
        $$;
        """
    )
    conversation_status = postgresql.ENUM(
        "OPEN",
        "CLOSED",
        name="conversation_status_enum",
        create_type=False,
    )

    op.create_table(
        "communication_threads",
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("status", conversation_status, nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_communication_threads_student_id"), "communication_threads", ["student_id"], unique=False)

    op.create_table(
        "communication_messages",
        sa.Column("thread_id", sa.UUID(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["thread_id"], ["communication_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_communication_messages_thread_id"), "communication_messages", ["thread_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_communication_messages_thread_id"), table_name="communication_messages")
    op.drop_table("communication_messages")
    op.drop_index(op.f("ix_communication_threads_student_id"), table_name="communication_threads")
    op.drop_table("communication_threads")
    postgresql.ENUM(name="conversation_status_enum").drop(op.get_bind(), checkfirst=True)
