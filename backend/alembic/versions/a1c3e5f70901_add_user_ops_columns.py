"""add admin/ops columns to users

Revision ID: a1c3e5f70901
Revises: d9a4f2b3c1e8
Create Date: 2026-06-10 09:00:00.000000

운영자 기능용 User 컬럼 5종(모두 nullable — backfill 불필요):
- admin_comp_until    : 운영자 제공 이용권(comp) 만료시각. 결제와 분리.
- admin_comp_note     : 부여 사유/메모.
- ai_daily_limit      : 사용자별 AI 일일 호출 상한(null=전역 기본값).
- last_active_at      : 마지막 활동 시각.
- token_valid_after   : 이 시각 이전 발급 토큰 무효(강제 로그아웃).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c3e5f70901'
down_revision: Union[str, None] = 'd9a4f2b3c1e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('admin_comp_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('admin_comp_note', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('ai_daily_limit', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('token_valid_after', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'token_valid_after')
    op.drop_column('users', 'last_active_at')
    op.drop_column('users', 'ai_daily_limit')
    op.drop_column('users', 'admin_comp_note')
    op.drop_column('users', 'admin_comp_until')
