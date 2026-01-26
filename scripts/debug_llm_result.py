import sys
import os
import asyncio

# Setup Path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../backend"))
sys.path.append(backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.librarian import LibrarianService
import textwrap

async def inspect_llm():
    service = LibrarianService()
    try:
        res = await service.agent.run("Hi")
        print(f"\nType: {type(res)}")
        print(f"Dir: {dir(res)}")
        # Try .data
        try:
             print(f"res.data: {res.data}")
        except:
             print("res.data failed")
    except Exception as e:
        print(e)

if __name__ == "__main__":
    asyncio.run(inspect_llm())
