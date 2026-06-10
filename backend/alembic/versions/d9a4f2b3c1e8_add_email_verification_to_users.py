"""add email verification columns to users

Revision ID: d9a4f2b3c1e8
Revises: b6e1f3c8d4a9
Create Date: 2026-05-27 20:00:00.000000

봇 가입 차단용 이메일 인증 시스템 도입.
- email_verified (Boolean, 기존 사용자 backfill 후 NOT NULL 로 승격)
- email_verification_token (String 64, hashed, indexed)
- email_verification_expires_at (DateTime UTC, nullable)

3단계 절차로 PostgreSQL DEFAULT 캐스팅 이슈 회피:
  1) ADD COLUMN ... NULL  (server_default 없음 → DEFAULT 절 자체가 SQL 에 들어가지 않음)
  2) UPDATE 로 기존 사용자 전부 TRUE 로 backfill
  3) ALTER COLUMN ... SET NOT NULL  (server_default 도 함께 부착해 신규 가입은 application default 적용)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9a4f2b3c1e8'
down_revision: Union[str, None] = 'b6e1f3c8d4a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) email_verified — NULL 허용 상태로 추가 (DEFAULT 절 미포함).
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=True))
    # 2) 기존 사용자 backfill — 운영자/테스터 UX 보존.
    op.execute('UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL')
    # 3) NOT NULL 로 승격 + server_default 부착 (신규 행은 false).
    #    SQLite 는 ALTER COLUMN 미지원 — batch_alter_table 로 테이블 재생성 방식 사용.
    #    (프로덕션 Postgres 에는 이미 적용된 리비전이므로 동작 변화 없음 — 로컬 dev 전용 호환 수정)
    if op.get_bind().dialect.name == 'sqlite':
        with op.batch_alter_table('users') as batch_op:
            batch_op.alter_column(
                'email_verified',
                existing_type=sa.Boolean(),
                nullable=False,
                server_default=sa.text('FALSE'),
            )
    else:
        op.alter_column(
            'users',
            'email_verified',
            nullable=False,
            server_default=sa.text('FALSE'),
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


def downgrade() -> None:
    op.drop_index('ix_users_email_verification_token', table_name='users')
    op.drop_column('users', 'email_verification_expires_at')
    op.drop_column('users', 'email_verification_token')
    op.drop_column('users', 'email_verified')
