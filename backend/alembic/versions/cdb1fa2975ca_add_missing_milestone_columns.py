"""add_missing_milestone_columns

Revision ID: cdb1fa2975ca
Revises: fb1149f96018
Create Date: 2026-01-24 23:44:01.123456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cdb1fa2975ca'
down_revision: Union[str, Sequence[str], None] = 'fb1149f96018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add missing columns to milestones table
    op.execute("""
        DO $$ BEGIN
            -- Add name column if not exists
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='milestones' AND column_name='name') THEN
                ALTER TABLE milestones ADD COLUMN name VARCHAR NOT NULL DEFAULT '';
            END IF;

            -- Add target_date column if not exists
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='milestones' AND column_name='target_date') THEN
                ALTER TABLE milestones ADD COLUMN target_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW();
            END IF;

            -- Add status column if not exists
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='milestones' AND column_name='status') THEN
                ALTER TABLE milestones ADD COLUMN status milestonestatusenum NOT NULL DEFAULT 'planned';
            END IF;

            -- Add priority column if not exists
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='milestones' AND column_name='priority') THEN
                ALTER TABLE milestones ADD COLUMN priority INTEGER NOT NULL DEFAULT 5;
            END IF;

            -- Add description column if not exists
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='milestones' AND column_name='description') THEN
                ALTER TABLE milestones ADD COLUMN description VARCHAR NULL;
            END IF;
        END $$;
    """)

    # Remove default constraints after adding columns
    op.execute("""
        ALTER TABLE milestones ALTER COLUMN name DROP DEFAULT;
        ALTER TABLE milestones ALTER COLUMN target_date DROP DEFAULT;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop added columns
    op.execute("""
        ALTER TABLE milestones
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS priority,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS target_date,
        DROP COLUMN IF EXISTS name;
    """)
