import asyncio
import uuid
import json
from app.services.librarian import LibrarianService
from app.infrastructure.db import get_engine
from app.domain.models import User, Area, Product, Task, Topic
from sqlmodel import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

async def test_full_governance_flow():
    service = LibrarianService()
    user_id = uuid.uuid4()
    
    print(f"--- [TEST] Initializing User {user_id} ---")
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        user = User(id=user_id, email=f"test_gov_{user_id.hex[:6]}@example.com")
        session.add(user)
        await session.commit()

    print("\n--- [TEST] Step 1: Messy Ingestion (Japan Moving Tasks) ---")
    messy_input = """
    1. 日本公司設立：需要準備印章證明
    2. Amazon 訂單確認：搬家用的紙箱
    3. eSIM 業務辦理：更換日本門號
    """
    await service.structure_chaos(messy_input, user_id)
    
    async with async_session() as session:
        stmt = select(Task).where(Task.user_id == user_id)
        tasks = (await session.execute(stmt)).scalars().all()
        print(f"Ingested {len(tasks)} tasks.")
        for t in tasks:
            prod = await session.get(Product, t.product_id)
            area = await session.get(Area, prod.area_id)
            print(f"  - [{t.id}] {t.content[:30]} | Area: {area.name} | Product: {prod.name}")

    print("\n--- [TEST] Step 2: Context-Aware Governance Command ---")
    # This is what was failing due to prompt formatting error
    instruction = "把所有關於日本、訂單和 eSIM 的行政任務，全部移動到『日本搬家』專案下"
    print(f"Instruction: {instruction}")
    
    try:
        result = await service.execute_governance_instruction(instruction, user_id)
        print(f"Governance Result: {result}")
    except Exception as e:
        print(f"CRITICAL FAILURE in execution: {e}")
        import traceback; traceback.print_exc()
        return

    print("\n--- [TEST] Step 3: Verification ---")
    async with async_session() as session:
        # Check if '日本搬家' product exists
        stmt_p = select(Product).where(Product.user_id == user_id).where(Product.name == "日本搬家")
        japan_prod = (await session.execute(stmt_p)).scalars().first()
        
        if not japan_prod:
            # Fallback check for case sensitivity or accidental English mapping
            stmt_all_p = select(Product).where(Product.user_id == user_id)
            all_prods = (await session.execute(stmt_all_p)).scalars().all()
            print(f"DEBUG: Current products for user: {[p.name for p in all_prods]}")

        if japan_prod:
            print(f"SUCCESS: Product '日本搬家' created.")
            stmt_t = select(Task).where(Task.product_id == japan_prod.id)
            moved_tasks = (await session.execute(stmt_t)).scalars().all()
            print(f"Tasks now in '日本搬家': {len(moved_tasks)}")
            if len(moved_tasks) >= 2:
                print("\n✅ TEST PASSED: Specific Chinese naming followed.")
            else:
                print("\n❌ TEST FAILED: Tasks not moved.")
        else:
            print("\n❌ TEST FAILED: Target product '日本搬家' was not found.")

if __name__ == "__main__":
    # Ensure backend is in path
    import sys
    import os
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    asyncio.run(test_full_governance_flow())
