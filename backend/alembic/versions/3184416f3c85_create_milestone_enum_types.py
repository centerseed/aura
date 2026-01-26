"""create_milestone_enum_types

Revision ID: 3184416f3c85
Revises: 1ec2de03811f
Create Date: 2026-01-24 23:40:59.160353

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3184416f3c85'
down_revision: Union[str, Sequence[str], None] = '1ec2de03811f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create milestone-related enum types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE milestonestatusenum AS ENUM ('planned', 'in_progress', 'completed', 'delayed', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE milestoneentitytypeenum AS ENUM ('area', 'product', 'topic');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE urgencylevelenum AS ENUM ('critical', 'high', 'medium', 'low');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS urgencylevelenum CASCADE")
    op.execute("DROP TYPE IF EXISTS milestoneentitytypeenum CASCADE")
    op.execute("DROP TYPE IF EXISTS milestonestatusenum CASCADE")
