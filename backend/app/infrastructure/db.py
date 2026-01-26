"""
資料庫基礎設施模組

提供統一的資料庫連線管理和會話工廠。
"""
import os
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# 確保使用 async driver
if DATABASE_URL and not DATABASE_URL.startswith("postgresql+asyncpg"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Event loop 綁定的引擎快取（Streamlit 相容）
_engine_cache: dict[int, AsyncEngine] = {}


def get_engine() -> AsyncEngine:
    """取得當前 event loop 綁定的資料庫引擎"""
    try:
        loop = asyncio.get_running_loop()
        loop_id = id(loop)
    except RuntimeError:
        # 無 running loop 時使用預設 ID
        loop_id = 0

    if loop_id not in _engine_cache:
        _engine_cache[loop_id] = create_async_engine(
            DATABASE_URL,
            echo=False,
            future=True,
            pool_pre_ping=True  # 連線健康檢查
        )
    return _engine_cache[loop_id]


def get_session_factory() -> sessionmaker:
    """取得會話工廠（可重複使用）"""
    return sessionmaker(
        get_engine(),
        class_=AsyncSession,
        expire_on_commit=False
    )


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    統一的資料庫會話上下文管理器。

    用法:
        async with get_db_session() as session:
            result = await session.execute(...)
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """初始化資料庫（驗證連線）"""
    engine = get_engine()
    async with engine.begin() as conn:
        pass


# FastAPI 依賴注入用（保留向後兼容）
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_db_session() as session:
        yield session
