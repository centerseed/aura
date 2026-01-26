"""
基礎設施層

提供與外部系統的整合：
- db: 資料庫連線管理
- llm: LLM 適配器（Gemini, OpenAI 等）
- mcp: Model Context Protocol 整合
- persistence: 持久化實作
"""
from .db import get_db_session, get_engine

__all__ = ["get_db_session", "get_engine"]
