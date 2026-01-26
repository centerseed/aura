"""add_task_start_date

Revision ID: 539ce44ec733
Revises: 6600ff9f3621
Create Date: 2026-01-25 00:49:49.301988

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '539ce44ec733'
down_revision: Union[str, Sequence[str], None] = '6600ff9f3621'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add start_date column to tasks table."""
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='tasks' AND column_name='start_date'
            ) THEN
                ALTER TABLE tasks
                ADD COLUMN start_date TIMESTAMP WITHOUT TIME ZONE NULL;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove start_date column from tasks table."""
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS start_date;")
