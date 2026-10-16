"""export attempt audit trail

Revision ID: b7d4e2a91c05
Revises: 7e4c1a90b2df
Create Date: 2026-10-17 00:00:00.000000

Adds `export_attempt`: one row per purchase-order export attempt, capturing
whether the document was produced (succeeded) or refused (failed) and, on
success, the sha256 of the rendered HTML so identical retries share one
document identity. There is intentionally no "sent"/"accepted" state — an
export only ever means the file was produced locally. Rows are store- and
order-scoped and cascade with their order.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7d4e2a91c05'
down_revision: str | None = '7e4c1a90b2df'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'export_attempt',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column(
            'store_id',
            sa.String(length=36),
            sa.ForeignKey('store.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'order_id',
            sa.String(length=36),
            sa.ForeignKey('purchase_order.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('approval_id', sa.String(length=36), nullable=False),
        sa.Column('plan_id', sa.String(length=36), nullable=False),
        sa.Column('plan_version', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('failure_code', sa.String(length=48), nullable=True),
        sa.Column('failure_message', sa.Text(), nullable=True),
        sa.Column('document_digest', sa.String(length=64), nullable=True),
        sa.Column('actor_id', sa.String(length=80), nullable=False),
        sa.Column(
            'attempted_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index('ix_export_attempt_store_id', 'export_attempt', ['store_id'])
    op.create_index('ix_export_attempt_order_id', 'export_attempt', ['order_id'])


def downgrade() -> None:
    op.drop_index('ix_export_attempt_order_id', table_name='export_attempt')
    op.drop_index('ix_export_attempt_store_id', table_name='export_attempt')
    op.drop_table('export_attempt')
