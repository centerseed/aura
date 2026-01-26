"""
領域層 (Domain Layer)

定義核心業務邏輯，無外部框架依賴：
- models: SQLModel ORM 模型
- schemas: Pydantic 序列化模型
- exceptions: 領域異常
- entities: 業務實體（無 ORM 依賴）
- interfaces: 行為介面定義
"""
from .models import (
    User, Area, Product, Topic, Task,
    GovernanceProposal,
    StatusEnum, LifecycleEnum, ProposalStatusEnum,
)

__all__ = [
    "User", "Area", "Product", "Topic", "Task",
    "GovernanceProposal",
    "StatusEnum", "LifecycleEnum", "ProposalStatusEnum",
]
