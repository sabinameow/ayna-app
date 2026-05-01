"""expand notifications and device tokens

Revision ID: 5f4b8d3c1a11
Revises: e2dd7db6c8be
Create Date: 2026-05-01 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "5f4b8d3c1a11"
down_revision: Union[str, None] = "e2dd7db6c8be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("device_token", sa.String(length=512), nullable=True))

    op.add_column("notifications", sa.Column("role", sa.String(length=20), nullable=True))
    op.add_column(
        "notifications",
        sa.Column(
            "type",
            sa.String(length=100),
            nullable=False,
            server_default="system.general",
        ),
    )
    op.alter_column("notifications", "body", new_column_name="message")
    op.add_column(
        "notifications",
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column("notifications", sa.Column("dedupe_key", sa.String(length=255), nullable=True))

    op.execute(
        """
        UPDATE notifications
        SET role = COALESCE(
            (SELECT users.role::text FROM users WHERE users.id = notifications.user_id),
            'patient'
        )
        WHERE role IS NULL
        """
    )

    op.alter_column("notifications", "role", nullable=False)
    op.alter_column("notifications", "type", server_default=None)
    op.create_index(
        "ix_notifications_user_created",
        "notifications",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_notifications_user_dedupe_key",
        "notifications",
        ["user_id", "dedupe_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_notifications_user_dedupe_key", "notifications", type_="unique")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_column("notifications", "dedupe_key")
    op.drop_column("notifications", "metadata")
    op.alter_column("notifications", "message", new_column_name="body")
    op.drop_column("notifications", "type")
    op.drop_column("notifications", "role")
    op.drop_column("users", "device_token")
