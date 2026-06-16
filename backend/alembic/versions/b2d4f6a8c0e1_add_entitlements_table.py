"""add entitlements table

moa365 ↔ atmbook 통합 계정의 교차 이용 권한(Entitlement) 저장 테이블.

Revision ID: b2d4f6a8c0e1
Revises: d9a4f2b3c1e8
Create Date: 2026-06-02 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2d4f6a8c0e1'
down_revision: Union[str, None] = 'd9a4f2b3c1e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'entitlements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('product', sa.String(length=16), nullable=False),
        sa.Column('sku', sa.String(length=64), nullable=False),
        sa.Column('source', sa.String(length=24), nullable=False),
        sa.Column('source_ref', sa.String(length=96), server_default='', nullable=False),
        sa.Column('status', sa.String(length=16), server_default='active', nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'sku', 'source_ref', name='uq_entitlement_user_sku_ref'),
    )
    op.create_index(op.f('ix_entitlements_user_id'), 'entitlements', ['user_id'], unique=False)
    op.create_index('ix_entitlement_user_sku', 'entitlements', ['user_id', 'sku'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_entitlement_user_sku', table_name='entitlements')
    op.drop_index(op.f('ix_entitlements_user_id'), table_name='entitlements')
    op.drop_table('entitlements')
