"""add planned recurrence columns

Revision ID: d2e5f1a3b9c7
Revises: c8a1b2d3e4f5
Create Date: 2026-05-20 16:00:00.000000

반복 지출 기능을 위해 Planned 모델에 3개 컬럼 추가.
server_default='none' 으로 기존 행은 자동 백필 (일회성으로 간주).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2e5f1a3b9c7'
down_revision: Union[str, None] = 'c8a1b2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'planned',
        sa.Column('recurrence', sa.String(length=20), nullable=False, server_default='none'),
    )
    op.add_column(
        'planned',
        sa.Column('recurrence_day', sa.Integer(), nullable=True),
    )
    op.add_column(
        'planned',
        sa.Column('recurrence_until', sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('planned', 'recurrence_until')
    op.drop_column('planned', 'recurrence_day')
    op.drop_column('planned', 'recurrence')
