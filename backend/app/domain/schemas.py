from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
import uuid

class Tag(BaseModel):
    area: str = Field(description="Life Area (e.g., Work, Life, Health)")
    product: str = Field(description="Product/Project Name (e.g., Naruvia, Tax Filing)")
    topic: str = Field(description="Activity Type (e.g., Dev, Admin, Meeting)")

class EvolvedObj(BaseModel):
    """
    Structured output from Librarian Analysis based on First Principles.
    """
    title: str = Field(description="Concise, Actionable Title")
    narrative: str = Field(description="Full narrative context and reasoning")
    drawer: str = Field(description="Status: ACTIVE, MAINTAIN, REFERENCE, ARCHIVE, or INBOX")
    tag: Tag
    strategy_used: str = Field(description="Entropy Reduction or High Entropy Preservation")
    reasoning: str = Field(description="Why this categorization?")

class AnalysisResult(BaseModel):
    items: List[EvolvedObj]

# ===== Sub-items Schemas =====

class SubItem(BaseModel):
    """Sub-item within a Task (todo list item)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str = Field(min_length=1, max_length=500)
    completed: bool = Field(default=False)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None
    order: int = Field(default=0, ge=0)

class SubItemsMeta(BaseModel):
    """統計資訊 for sub-items"""
    total: int = 0
    completed: int = 0
    completion_rate: float = Field(default=0.0, ge=0.0, le=1.0)

# ===== References Schemas =====

class Reference(BaseModel):
    """Task 的參考資料 (URL 或純文字備註)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["url", "note"] = Field(description="參考資料類型: url 或 note")
    content: str = Field(min_length=1, description="URL 或純文字內容")
    title: Optional[str] = Field(default=None, description="URL 的標題 (可選)")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class CreateReferenceRequest(BaseModel):
    """Request to add a reference to a task"""
    task_id: str
    type: Literal["url", "note"]
    content: str = Field(min_length=1)
    title: Optional[str] = None

class UpdateReferenceRequest(BaseModel):
    """Request to update an existing reference"""
    task_id: str
    reference_id: str
    content: Optional[str] = Field(default=None, min_length=1)
    title: Optional[str] = None

# ===== API Request Schemas =====

class CreateSubItemRequest(BaseModel):
    """Request to create a new sub-item"""
    task_id: str
    content: str = Field(min_length=1, max_length=500)

class UpdateSubItemRequest(BaseModel):
    """Request to update an existing sub-item"""
    task_id: str
    sub_item_id: str
    content: Optional[str] = Field(default=None, min_length=1, max_length=500)
    completed: Optional[bool] = None
    order: Optional[int] = Field(default=None, ge=0)

class ReorderSubItemsRequest(BaseModel):
    """Request to reorder multiple sub-items"""
    task_id: str
    sub_item_orders: List[dict]  # [{"id": str, "order": int}]

# ===== API Response Schemas =====

class TaskWithSubItems(BaseModel):
    """Task with sub-items for API responses"""
    id: str
    content: str
    narrative: Optional[str] = None
    status: Optional[str] = None
    sub_items: List[SubItem] = []
    sub_items_meta: SubItemsMeta = SubItemsMeta()

# ===== Reorganize Schemas =====

class TopicCluster(BaseModel):
    """AI 建議的 Topic 群聚"""
    topic_name: str = Field(description="建議的 Topic 名稱")
    description: str = Field(description="這個 Topic 的語義描述")
    task_ids: List[str] = Field(description="屬於這個 Topic 的 Task IDs")
    confidence: float = Field(ge=0.0, le=1.0, description="AI 的信心度")

class TaskTimeInference(BaseModel):
    """Task 時間推斷結果"""
    task_id: str
    suggested_due_date: Optional[str] = Field(description="建議的截止日期 (ISO 8601)")
    inferred_from_milestone_id: Optional[str] = Field(description="從哪個 Milestone 推斷出來的")
    time_confidence: float = Field(ge=0.0, le=1.0, description="時間推斷的信心度")
    urgency_level: str = Field(description="緊急程度: critical, high, medium, low")
    reasoning: str = Field(description="時間推斷的理由")

class ReorganizeProposal(BaseModel):
    """Product Topics 重組提案"""
    product_id: str
    product_name: str
    current_topics: List[str] = Field(description="目前的 Topics")
    proposed_clusters: List[TopicCluster] = Field(description="AI 建議的新 Topic 分群")
    time_inferences: List[TaskTimeInference] = Field(description="所有 Tasks 的時間推斷")
    reasoning: str = Field(description="重組的理由與邏輯")
