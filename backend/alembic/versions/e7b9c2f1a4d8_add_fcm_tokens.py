"""add fcm_tokens table

Revision ID: e7b9c2f1a4d8
Revises: d2e5f1a3b9c7
Create Date: 2026-05-23 18:00:00.000000

FCM 푸시 알림 토큰 저장용 신규 테이블.
- user_id: users.id FK (CASCADE delete)
- token: 디바이스 고유 토큰 (unique)
- platform: android | ios | web
- device_info: 디바이스 식별용 자유 입력
- created_at / last_seen_at: 토큰 lifecycle 추적
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7b9c2f1a4d8'
down_revision: Union[str, None] = 'd2e5f1a3b9c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'fcm_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('token', sa.String(length=512), nullable=False),
        sa.Column(
            'platform',
            sa.String(length=16),
            nullable=False,
            server_default='android',
        ),
        sa.Column('device_info', sa.String(length=255), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            'last_seen_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint('token', name='uq_fcm_token'),
    )
    op.create_index('ix_fcm_tokens_user_id', 'fcm_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_fcm_tokens_user_id', table_name='fcm_tokens')
    op.drop_table('fcm_tokens')
