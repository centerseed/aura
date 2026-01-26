"""
驗證 AI Time Inference System 的資料模型
測試 Milestone model 與 Task 時間欄位擴充
"""
import asyncio
import sys
import os
import uuid as uuid_lib
from datetime import datetime, timedelta
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.domain.models import (
    User, Area, Product, Task, Milestone
)
from app.infrastructure.db import get_db_session
from sqlmodel import select


async def test_milestone_creation():
    """測試 Milestone 建立功能"""
    print("\n=== 測試 1: Milestone 建立 ===")

    async with get_db_session() as session:
        # 建立測試用戶 (使用隨機 email 避免衝突)
        test_email = f"test_{uuid_lib.uuid4().hex[:8]}@naruvia.local"
        user = User(email=test_email, settings={})
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"✓ 建立測試用戶: {user.email}")

        # 建立測試 Area
        area = Area(user_id=user.id, name="測試領域", is_custom=True)
        session.add(area)
        await session.commit()
        await session.refresh(area)
        print(f"✓ 建立測試 Area: {area.name}")

        # 建立測試 Product
        product = Product(
            user_id=user.id,
            area_id=area.id,
            name="測試專案"
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)
        print(f"✓ 建立測試 Product: {product.name}")

        # 建立 Milestone for Product
        milestone1 = Milestone(
            user_id=user.id,
            entity_type="product",  # POC: 直接使用字串
            entity_id=product.id,
            name="MVP Release",
            target_date=datetime.now() + timedelta(days=30),
            status="in_progress",  # POC: 直接使用字串
            priority=8,
            description="第一版本發布"
        )
        session.add(milestone1)
        await session.commit()
        await session.refresh(milestone1)
        print(f"✓ 建立 Milestone: {milestone1.name} (優先級: {milestone1.priority})")

        # 建立第二個 Milestone (同一個 Product)
        milestone2 = Milestone(
            user_id=user.id,
            entity_type="product",  # POC: 直接使用字串
            entity_id=product.id,
            name="安全審查完成",
            target_date=datetime.now() + timedelta(days=45),
            status="planned",  # POC: 直接使用字串
            priority=6
        )
        session.add(milestone2)
        await session.commit()
        await session.refresh(milestone2)
        print(f"✓ 建立第二個 Milestone: {milestone2.name}")

        # 查詢該 Product 的所有 Milestones
        result = await session.execute(
            select(Milestone)
            .where(Milestone.entity_type == "product")
            .where(Milestone.entity_id == product.id)
            .order_by(Milestone.target_date)
        )
        milestones = result.scalars().all()
        print(f"\n✓ 查詢到 {len(milestones)} 個 Milestones:")
        for ms in milestones:
            print(f"  - {ms.name}: {ms.target_date.strftime('%Y-%m-%d')} ({ms.status})")

        return user.id, product.id, milestone1.id


async def test_task_time_fields(user_id, product_id, milestone_id):
    """測試 Task 時間欄位擴充"""
    print("\n=== 測試 2: Task 時間欄位 ===")

    async with get_db_session() as session:
        # 建立帶有時間資訊的 Task
        task = Task(
            user_id=user_id,
            product_id=product_id,
            content="完成 OAuth 登入功能",
            due_date=datetime.now() + timedelta(days=7),
            inferred_from_milestone_id=milestone_id,
            time_confidence=0.85,
            urgency_level="high",  # POC: 直接使用字串
            ai_analysis={
                "time_reasoning": "此任務需在 MVP Release 前完成,設定為 7 天後",
                "related_milestone_ids": [str(milestone_id)]
            }
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)

        print(f"✓ 建立 Task: {task.content}")
        print(f"  - Due Date: {task.due_date.strftime('%Y-%m-%d')}")
        print(f"  - Time Confidence: {task.time_confidence}")
        print(f"  - Urgency Level: {task.urgency_level}")
        print(f"  - Inferred From Milestone ID: {task.inferred_from_milestone_id}")
        print(f"  - AI Reasoning: {task.ai_analysis.get('time_reasoning')}")

        # 查詢與 Milestone 關聯的所有 Tasks
        result = await session.execute(
            select(Task).where(Task.inferred_from_milestone_id == milestone_id)
        )
        related_tasks = result.scalars().all()
        print(f"\n✓ 與 Milestone 關聯的任務數量: {len(related_tasks)}")

        return task.id


async def test_timeline_query(user_id):
    """測試 Timeline 查詢功能"""
    print("\n=== 測試 3: Timeline 查詢 ===")

    async with get_db_session() as session:
        # 查詢今天到期的任務
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        result = await session.execute(
            select(Task)
            .where(Task.user_id == user_id)
            .where(Task.due_date >= today_start)
            .where(Task.due_date < today_end)
        )
        today_tasks = result.scalars().all()
        print(f"✓ 今天到期的任務: {len(today_tasks)} 個")

        # 查詢已逾期的任務
        result = await session.execute(
            select(Task)
            .where(Task.user_id == user_id)
            .where(Task.due_date < datetime.now())
        )
        overdue_tasks = result.scalars().all()
        print(f"✓ 已逾期的任務: {len(overdue_tasks)} 個")

        # 查詢本週到期的任務
        week_end = today_start + timedelta(days=7)
        result = await session.execute(
            select(Task)
            .where(Task.user_id == user_id)
            .where(Task.due_date >= today_start)
            .where(Task.due_date < week_end)
            .order_by(Task.due_date)
        )
        week_tasks = result.scalars().all()
        print(f"✓ 本週到期的任務: {len(week_tasks)} 個")

        for task in week_tasks:
            days_until = (task.due_date - datetime.now()).days
            print(f"  - {task.content}: {days_until} 天後 (信心: {task.time_confidence})")


async def cleanup_test_data(user_id):
    """清理測試數據"""
    print("\n=== 清理測試數據 ===")

    async with get_db_session() as session:
        # 刪除測試用戶的所有數據
        from sqlmodel import delete

        await session.execute(delete(Task).where(Task.user_id == user_id))
        await session.execute(delete(Milestone).where(Milestone.user_id == user_id))
        await session.execute(delete(Product).where(Product.user_id == user_id))
        await session.execute(delete(Area).where(Area.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))

        await session.commit()
        print("✓ 測試數據已清理")


async def main():
    print("=" * 60)
    print("AI Time Inference System - Schema Verification")
    print("=" * 60)

    try:
        # 測試 1: Milestone 建立
        user_id, product_id, milestone_id = await test_milestone_creation()

        # 測試 2: Task 時間欄位
        task_id = await test_task_time_fields(user_id, product_id, milestone_id)

        # 測試 3: Timeline 查詢
        await test_timeline_query(user_id)

        # 清理測試數據
        await cleanup_test_data(user_id)

        print("\n" + "=" * 60)
        print("✅ 所有測試通過! Phase 1 資料模型驗證成功")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ 測試失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
