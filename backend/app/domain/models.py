import uuid
from datetime import datetime
from typing import Optional, List, Any, Dict
from enum import Enum as PyEnum
from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from pgvector.sqlalchemy import Vector
from sqlalchemy import text

# --- Enums ---

class StatusEnum(str, PyEnum):
    INBOX = "00_inbox"
    ACTIVE = "10_active"
    MAINTAIN = "20_maintain"
    REFERENCE = "30_reference"
    ARCHIVE = "40_archive"

class LifecycleEnum(str, PyEnum):
    FINITE = "finite"      # Has a deadline (Project)
    PERPETUAL = "perpetual" # Continuous maintenance (Asset)

class ProposalStatusEnum(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class MilestoneStatusEnum(str, PyEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"

class MilestoneEntityTypeEnum(str, PyEnum):
    AREA = "area"
    PRODUCT = "product"
    TOPIC = "topic"

class UrgencyLevelEnum(str, PyEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

# --- Base Model ---

class BaseTable(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})
    deleted_at: Optional[datetime] = Field(default=None)

# --- Models ---

class User(BaseTable, table=True):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}
    email: str = Field(unique=True, index=True)
    settings: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    # Relationships
    areas: List["Area"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    products: List["Product"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    tasks: List["Task"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    milestones: List["Milestone"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Area(BaseTable, table=True):
    __tablename__ = "areas"
    __table_args__ = {"extend_existing": True}
    user_id: uuid.UUID = Field(foreign_key="users.id")
    name: str
    description: Optional[str] = None
    is_custom: bool = Field(default=False)
    scope: Optional[str] = None  # 簡單描述：這個身分包含什麼類型的事務
    rolling_summary: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    user: User = Relationship(back_populates="areas")
    products: List["Product"] = Relationship(back_populates="area")

class Product(BaseTable, table=True):
    __tablename__ = "products"
    __table_args__ = {"extend_existing": True}
    user_id: uuid.UUID = Field(foreign_key="users.id")
    area_id: uuid.UUID = Field(foreign_key="areas.id")
    name: str
    description: Optional[str] = None
    status: StatusEnum = Field(default=StatusEnum.INBOX)
    lifecycle: LifecycleEnum = Field(default=LifecycleEnum.FINITE)
    
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(768)))

    user: User = Relationship(back_populates="products")
    area: Area = Relationship(back_populates="products")
    topics: List["Topic"] = Relationship(back_populates="product")
    tasks: List["Task"] = Relationship(back_populates="product")

class Topic(BaseTable, table=True):
    __tablename__ = "topics"
    __table_args__ = {"extend_existing": True}
    user_id: uuid.UUID = Field(foreign_key="users.id")
    product_id: uuid.UUID = Field(foreign_key="products.id")
    name: str
    
    semantic_center: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(768)))

    product: Product = Relationship(back_populates="topics")
    tasks: List["Task"] = Relationship(back_populates="topic")

class Task(BaseTable, table=True):
    __tablename__ = "tasks"
    __table_args__ = {"extend_existing": True}
    user_id: uuid.UUID = Field(foreign_key="users.id")
    product_id: uuid.UUID = Field(foreign_key="products.id")
    topic_id: Optional[uuid.UUID] = Field(default=None, foreign_key="topics.id")

    content: str
    status: StatusEnum = Field(default=StatusEnum.INBOX)

    # Time inference fields
    start_date: Optional[datetime] = Field(default=None)
    due_date: Optional[datetime] = Field(default=None)
    inferred_from_milestone_id: Optional[uuid.UUID] = Field(default=None, foreign_key="milestones.id")
    time_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    urgency_level: Optional[str] = Field(default=None)  # POC: 使用 str 而非 enum

    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(768)))
    ai_analysis: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    references: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))

    user: User = Relationship(back_populates="tasks")
    product: Product = Relationship(back_populates="tasks")
    topic: Optional[Topic] = Relationship(back_populates="tasks")
    inferred_milestone: Optional["Milestone"] = Relationship(back_populates="inferred_tasks")

class GovernanceProposal(BaseTable, table=True):
    __tablename__ = "governance_proposals"
    __table_args__ = {"extend_existing": True}
    user_id: uuid.UUID = Field(foreign_key="users.id")
    type: str  # e.g. "create_product", "merge_topic"
    target_id: Optional[uuid.UUID] = None
    payload: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    status: ProposalStatusEnum = Field(default=ProposalStatusEnum.PENDING)

class Milestone(BaseTable, table=True):
    __tablename__ = "milestones"
    __table_args__ = {"extend_existing": True}

    user_id: uuid.UUID = Field(foreign_key="users.id")
    entity_type: str  # POC: 使用 str 而非 enum (值: 'area', 'product', 'topic')
    entity_id: uuid.UUID  # Polymorphic reference to Area/Product/Topic

    name: str  # 里程碑名稱 (如 "MVP Release")
    target_date: datetime
    status: str = Field(default="planned")  # POC: 使用 str 而非 enum (值: 'planned', 'in_progress', 'completed', 'delayed', 'cancelled')
    priority: int = Field(default=5, ge=1, le=10)  # 優先級權重 (1-10)
    description: Optional[str] = None

    # Relationships
    user: User = Relationship(back_populates="milestones")
    inferred_tasks: List["Task"] = Relationship(back_populates="inferred_milestone")
