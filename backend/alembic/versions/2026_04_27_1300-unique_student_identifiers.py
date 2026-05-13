"""Add unique constraints for student identifiers.

Revision ID: 2026_04_27_1300
Revises: add_communications
Create Date: 2026-04-27 13:00:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "2026_04_27_1300"
down_revision: str | None = "add_communications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_profiles_document_number",
        "profiles",
        ["document_number"],
    )
    op.create_unique_constraint(
        "uq_profiles_student_id",
        "profiles",
        ["student_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_profiles_student_id", "profiles", type_="unique")
    op.drop_constraint("uq_profiles_document_number", "profiles", type_="unique")
