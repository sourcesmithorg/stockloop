"""store first-run completion flag

Revision ID: 7e4c1a90b2df
Revises: c8ad33d16cef
Create Date: 2026-10-16 17:20:00.000000

Adds an explicit, persisted "the owner finished store setup" flag to `store`.
Existing stores are backfilled to true: every store that predates this
migration has already been through setup (the demo fixture store ships with
products), and without the backfill those accounts would be locked into
/onboarding with no way out. Only stores created after this point start false.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7e4c1a90b2df'
down_revision: str | None = 'c8ad33d16cef'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'store',
        sa.Column(
            'first_run_complete',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )
    op.execute('UPDATE store SET first_run_complete = true')


def downgrade() -> None:
    op.drop_column('store', 'first_run_complete')
