"""add email verification columns to users

Revision ID: d9a4f2b3c1e8
Revises: b6e1f3c8d4a9
Create Date: 2026-05-27 20:00:00.000000

봇 가입 차단용 이메일 인증 시스템 도입.
- email_verified (Boolean NOT NULL default False)
- email_verification_token (String 64, hashed, indexed)
- email_verification_expires_at (DateTime UTC, nullable)

기존 사용자 (운영자 + 정상 테스터) 는 backfill 로 email_verified=TRUE 처리하여
이번 변경으로 인한 로그인 차단 경험 없도록 한다. 봇 5건도 같이 verified=true 가
되지만 admin soft-delete 로 별도 정리.

신규 가입자부터 email_verified=FALSE 로 들어오고 /auth/verify-email 통과 후 true 로 전환.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9a4f2b3c1e8'
down_revision: Union[str, None] = 'b6e1f3c8d4a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL Boolean 은 정수 0/1 을 자동 캐스팅하지 않음 → sa.false() 로 SQL FALSE 리터럴 생성.
    # SQLite 도 동일하게 동작.
    op.add_column(
        'users',
        sa.Column(
            'email_verified',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        'users',
        sa.Column('email_verification_token', sa.String(length=64), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('email_verification_expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'ix_users_email_verification_token',
        'users',
        ['email_verification_token'],
        unique=False,
    )
    # 기존 사용자 backfill — 운영자/테스터 UX 보존. 신규 가입은 application default(False) 적용.
    op.execute('UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE')


def downgrade() -> None:
    op.drop_index('ix_users_email_verification_token', table_name='users')
    op.drop_column('users', 'email_verification_expires_at')
    op.drop_column('users', 'email_verification_token')
    op.drop_column('users', 'email_verified')
