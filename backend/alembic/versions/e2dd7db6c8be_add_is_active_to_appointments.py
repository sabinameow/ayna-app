"""add is_active to appointments

Revision ID: e2dd7db6c8be
Revises: 69b8953dd983
Create Date: 2026-04-25 14:58:56.091582

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2dd7db6c8be'
down_revision: Union[str, None] = '69b8953dd983'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'appointments',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true())
    )


def downgrade() -> None:
    op.drop_column('appointments', 'is_active')
