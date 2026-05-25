"""add lemonsqueezy columns to users

Revision ID: b6e1f3c8d4a9
Revises: f3c8d2a5b6e1
Create Date: 2026-05-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b6e1f3c8d4a9'
down_revision: Union[str, None] = 'f3c8d2a5b6e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('lemonsqueezy_customer_id', sa.String(length=64), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('lemonsqueezy_subscription_id', sa.String(length=64), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('lemonsqueezy_variant_id', sa.String(length=64), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('lemonsqueezy_renews_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f('ix_users_lemonsqueezy_customer_id'),
        'users',
        ['lemonsqueezy_customer_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_users_lemonsqueezy_subscription_id'),
        'users',
        ['lemonsqueezy_subscription_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_users_lemonsqueezy_subscription_id'), table_name='users')
    op.drop_index(op.f('ix_users_lemonsqueezy_customer_id'), table_name='users')
    op.drop_column('users', 'lemonsqueezy_renews_at')
    op.drop_column('users', 'lemonsqueezy_variant_id')
    op.drop_column('users', 'lemonsqueezy_subscription_id')
    op.drop_column('users', 'lemonsqueezy_customer_id')
