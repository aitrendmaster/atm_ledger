"""add users.last_budget_breach_month for FCM budget alert dedup

Revision ID: f3c8d2a5b6e1
Revises: e7b9c2f1a4d8
Create Date: 2026-05-24 00:30:00.000000

예산 초과 푸시 알림 중복 방지용 컬럼. YYYY-MM 형식.
notifier.maybe_notify_budget_exceeded() 가 매월 첫 돌파 시 1회만 발송하도록.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3c8d2a5b6e1'
down_revision: Union[str, None] = 'e7b9c2f1a4d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('last_budget_breach_month', sa.String(length=7), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'last_budget_breach_month')
