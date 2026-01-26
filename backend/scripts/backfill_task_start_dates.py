#!/usr/bin/env python3
"""
Backfill script to set start_date for existing tasks.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/backfill_task_start_dates.py
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from app.domain.models import Task
from app.infrastructure.db import get_db_session


async def backfill_start_dates():
    """Backfill start_date for existing tasks with 2026-01-24."""
    default_start_date = datetime(2026, 1, 24, 0, 0, 0)

    try:
        async with get_db_session() as session:
            # Count tasks without start_date
            count_stmt = select(Task).where(Task.start_date.is_(None))
            count_result = await session.execute(count_stmt)
            tasks_to_update = count_result.scalars().all()

            print(f"Found {len(tasks_to_update)} tasks without start_date")

            if len(tasks_to_update) == 0:
                print("No tasks to backfill. Exiting.")
                return

            # Update all tasks without start_date
            stmt = (
                update(Task)
                .where(Task.start_date.is_(None))
                .values(start_date=default_start_date)
            )
            result = await session.execute(stmt)
            await session.commit()

            print(f"✅ Successfully backfilled {result.rowcount} tasks with start_date=2026-01-24")

            # Verify the update
            verify_stmt = select(Task).where(Task.start_date == default_start_date).limit(5)
            verify_result = await session.execute(verify_stmt)
            sample_tasks = verify_result.scalars().all()

            print("\nSample of updated tasks:")
            for task in sample_tasks:
                print(f"  - Task ID: {task.id}, start_date: {task.start_date}, due_date: {task.due_date}")

    except Exception as e:
        print(f"❌ Error during backfill: {e}")
        raise


if __name__ == "__main__":
    print("Starting backfill process...")
    asyncio.run(backfill_start_dates())
    print("Backfill complete!")
