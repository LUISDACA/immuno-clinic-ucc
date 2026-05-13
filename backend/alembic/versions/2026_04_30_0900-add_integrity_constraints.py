"""Add integrity constraints for vaccination and reset token data.

Revision ID: 2026_04_30_0900
Revises: 2026_04_29_1300
Create Date: 2026-04-30 09:00:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "2026_04_30_0900"
down_revision: str | None = "2026_04_29_1300"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_vaccine_dose_configs_vaccine_dose_number",
        "vaccine_dose_configs",
        ["vaccine_id", "dose_number"],
    )
    op.create_unique_constraint(
        "uq_student_vaccines_user_vaccine",
        "student_vaccines",
        ["user_id", "vaccine_id"],
    )
    op.create_unique_constraint(
        "uq_student_vaccine_doses_vaccine_config",
        "student_vaccine_doses",
        ["student_vaccine_id", "dose_config_id"],
    )
    op.create_unique_constraint(
        "uq_password_reset_tokens_token_hash",
        "password_reset_tokens",
        ["token_hash"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_password_reset_tokens_token_hash",
        "password_reset_tokens",
        type_="unique",
    )
    op.drop_constraint(
        "uq_student_vaccine_doses_vaccine_config",
        "student_vaccine_doses",
        type_="unique",
    )
    op.drop_constraint(
        "uq_student_vaccines_user_vaccine",
        "student_vaccines",
        type_="unique",
    )
    op.drop_constraint(
        "uq_vaccine_dose_configs_vaccine_dose_number",
        "vaccine_dose_configs",
        type_="unique",
    )
