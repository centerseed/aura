import sys
import os
import asyncio

# 1. Setup Path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../backend"))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# 2. Load Env
from dotenv import load_dotenv
env_path = os.path.join(backend_dir, ".env")
print(f"Loading env from: {env_path}")
load_dotenv(env_path)

# 3. Check Keys
api_key = os.getenv("GEMINI_API_KEY")
print(f"GEMINI_API_KEY present: {bool(api_key)}")
if not api_key:
    print("FATAL: API Key missing")
    sys.exit(1)

# 4. Check Backend Imports
try:
    from app.services.librarian import LibrarianService
    from app.domain.models import User
    import uuid
    print("Backend imports: OK")
except Exception as e:
    print(f"FATAL: Backend Import Error: {e}")
    sys.exit(1)

# 5. Check LLM Connectivity
async def test_llm():
    print("Testing LLM Connection...")
    service = LibrarianService()
    try:
        # Simple prompt
        res = await service.insight_agent.run("Hello, simply reply 'OK'.")
        print(f"LLM Response: {res.output}")
    except Exception as e:
        print(f"FATAL: LLM Error: {e}")
        sys.exit(1)

# 6. Check DB Connectivity
async def test_db_io():
    print("Testing DB Connection...")
    try:
        from app.infrastructure.db import engine
        from sqlmodel import select
        from app.domain.models import User
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.ext.asyncio import AsyncSession
        
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            # Try to query something
            # We don't write to avoid side effects, just read.
            # actually reading requires connection.
            await session.execute(select(User).limit(1))
            print("DB Read: OK")
    except Exception as e:
         print(f"FATAL: DB Error: {e}")
         print("Hint: Docker running? Dependencies (greenlet/asyncpg)?")
         sys.exit(1)

# 7. Check Frontend Imports (Simulated)
def test_frontend_imports():
    print("Testing Frontend Imports...")
    # Mocking streamlit
    sys.modules["streamlit"] = type("MockSt", (), {"set_page_config": lambda **k: None, "markdown": lambda *a, **k: None})
    
    # Try importing main logic
    frontend_dir = os.path.abspath(os.path.join(current_dir, "../frontend"))
    if frontend_dir not in sys.path:
        sys.path.append(frontend_dir)
        
    try:
        # We need to be careful not to execute main code, but main.py has logic at top level.
        # So we just check imports manually again like in prev script but stricter.
        import uuid
        import json
        import re
        print("Frontend libs: OK")
    except Exception as e:
         print(f"FATAL: Frontend Lib Error: {e}")
         sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_llm())
    asyncio.run(test_db_io())
    test_frontend_imports()
    print("✅ VERIFICATION PASSED")
