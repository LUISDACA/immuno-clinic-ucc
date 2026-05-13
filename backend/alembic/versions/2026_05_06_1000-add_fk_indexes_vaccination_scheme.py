"""add fk indexes to vaccination scheme tables

Revision ID: 2026_05_06_1000
Revises: e45a1bed3927
Create Date: 2026-05-06 10:00:00.000000

"""

from alembic import op

revision = "2026_05_06_1000"
down_revision = "e45a1bed3927"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_student_vaccines_user_id", "student_vaccines", ["user_id"])
    op.create_index("ix_student_vaccines_vaccine_id", "student_vaccines", ["vaccine_id"])
    op.create_index(
        "ix_student_vaccine_doses_student_vaccine_id",
        "student_vaccine_doses",
        ["student_vaccine_id"],
    )
    op.create_index(
        "ix_student_vaccine_doses_dose_config_id",
        "student_vaccine_doses",
        ["dose_config_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_student_vaccine_doses_dose_config_id", "student_vaccine_doses")
    op.drop_index(
        "ix_student_vaccine_doses_student_vaccine_id", "student_vaccine_doses"
    )
    op.drop_index("ix_student_vaccines_vaccine_id", "student_vaccines")
    op.drop_index("ix_student_vaccines_user_id", "student_vaccines")
