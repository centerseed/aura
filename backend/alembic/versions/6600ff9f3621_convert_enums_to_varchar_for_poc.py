"""convert_enums_to_varchar_for_poc

Revision ID: 6600ff9f3621
Revises: cdb1fa2975ca
Create Date: 2026-01-24 23:50:06.777297

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6600ff9f3621'
down_revision: Union[str, Sequence[str], None] = 'cdb1fa2975ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Convert enum columns to VARCHAR for POC simplicity

    # 1. Convert milestones.entity_type from enum to VARCHAR
    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN entity_type TYPE VARCHAR
        USING entity_type::text
    """)

    # 2. Convert milestones.status from enum to VARCHAR
    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN status TYPE VARCHAR
        USING status::text
    """)

    # 3. Add Task time inference fields if not exists
    op.execute("""
        DO $$ BEGIN
            -- Add due_date
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='tasks' AND column_name='due_date') THEN
                ALTER TABLE tasks ADD COLUMN due_date TIMESTAMP WITHOUT TIME ZONE NULL;
            END IF;

            -- Add inferred_from_milestone_id
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='tasks' AND column_name='inferred_from_milestone_id') THEN
                ALTER TABLE tasks ADD COLUMN inferred_from_milestone_id UUID NULL;
            END IF;

            -- Add time_confidence
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='tasks' AND column_name='time_confidence') THEN
                ALTER TABLE tasks ADD COLUMN time_confidence FLOAT NULL;
            END IF;

            -- Add urgency_level as VARCHAR
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='tasks' AND column_name='urgency_level') THEN
                ALTER TABLE tasks ADD COLUMN urgency_level VARCHAR NULL;
            ELSE
                ALTER TABLE tasks
                ALTER COLUMN urgency_level TYPE VARCHAR
                USING urgency_level::text;
            END IF;
        END $$;
    """)

    # 4. Add foreign key constraint for inferred_from_milestone_id
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_tasks_milestone'
                AND table_name = 'tasks'
            ) THEN
                ALTER TABLE tasks
                ADD CONSTRAINT fk_tasks_milestone
                FOREIGN KEY (inferred_from_milestone_id) REFERENCES milestones(id);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Revert VARCHAR columns back to enum types

    op.execute("""
        ALTER TABLE tasks
        ALTER COLUMN urgency_level TYPE urgencylevelenum
        USING urgency_level::urgencylevelenum
    """)

    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN status TYPE milestonestatusenum
        USING status::milestonestatusenum
    """)

    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN entity_type TYPE milestoneentitytypeenum
        USING entity_type::milestoneentitytypeenum
    """)
