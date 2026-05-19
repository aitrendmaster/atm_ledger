"""add locale country currency to users

Revision ID: c8a1b2d3e4f5
Revises: f2a0d7acdf14
Create Date: 2026-05-19 12:00:00.000000

신규 회원가입 시 국가 선택 → 통화/언어 자동 설정 기능을 위해
User 모델에 3개 컬럼 추가. server_default 로 기존 사용자는 자동 백필 (KR/KRW/ko).
모든 컬럼 NOT NULL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8a1b2d3e4f5'
down_revision: Union[str, None] = 'f2a0d7acdf14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('country_code', sa.String(length=2), nullable=False, server_default='KR'),
    )
    op.add_column(
        'users',
        sa.Column('currency_code', sa.String(length=3), nullable=False, server_default='KRW'),
    )
    op.add_column(
        'users',
        sa.Column('locale', sa.String(length=10), nullable=False, server_default='ko'),
    )


def downgrade() -> None:
    op.drop_column('users', 'locale')
    op.drop_column('users', 'currency_code')
    op.drop_column('users', 'country_code')
