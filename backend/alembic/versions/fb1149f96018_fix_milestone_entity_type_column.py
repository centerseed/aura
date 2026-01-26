"""fix_milestone_entity_type_column

Revision ID: fb1149f96018
Revises: 3184416f3c85
Create Date: 2026-01-24 23:41:58.123456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb1149f96018'
down_revision: Union[str, Sequence[str], None] = '3184416f3c85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Fix entity_type column
    # Step 1: Change column to TEXT temporarily
    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN entity_type TYPE TEXT
        USING entity_type::text
    """)

    # Step 2: Convert values to lowercase
    op.execute("""
        UPDATE milestones
        SET entity_type = LOWER(entity_type)
        WHERE entity_type IS NOT NULL
    """)

    # Step 3: Change column type to milestoneentitytypeenum
    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN entity_type TYPE milestoneentitytypeenum
        USING entity_type::milestoneentitytypeenum
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Revert to old enum type
    op.execute("""
        ALTER TABLE milestones
        ALTER COLUMN entity_type TYPE entitytypeenum
        USING entity_type::text::entitytypeenum
    """)
