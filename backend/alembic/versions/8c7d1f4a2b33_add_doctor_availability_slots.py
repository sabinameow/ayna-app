"""add doctor availability slots

Revision ID: 8c7d1f4a2b33
Revises: 5f4b8d3c1a11
Create Date: 2026-05-02 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8c7d1f4a2b33"
down_revision: Union[str, None] = "5f4b8d3c1a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "appointments",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    op.create_table(
        "doctor_availability_slots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("doctor_id", sa.UUID(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_booked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("appointment_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "doctor_id",
            "date",
            "start_time",
            "end_time",
            name="uq_doctor_availability_slot",
        ),
        sa.UniqueConstraint("appointment_id", name="uq_doctor_availability_appointment"),
    )
    op.create_index(
        "ix_doctor_availability_doctor_date",
        "doctor_availability_slots",
        ["doctor_id", "date", "is_booked"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_doctor_availability_doctor_date", table_name="doctor_availability_slots")
    op.drop_table("doctor_availability_slots")
    op.drop_column("appointments", "updated_at")
    op.drop_column("appointments", "created_at")
