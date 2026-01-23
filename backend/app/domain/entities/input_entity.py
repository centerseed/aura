from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class InputType(str, Enum):
    ACTION = "Action"
    NOTE = "Note"

class Status(str, Enum):
    ACTIVE = "Active"
    MAINTAIN = "Maintain"
    REFERENCE = "Reference"

class RiskLevel(str, Enum):
    GREEN = "🟢"
    YELLOW = "🟡"
    RED = "🔴"

class EntityTag(BaseModel):
    area: str
    project: Optional[str] = None
    topic: Optional[str] = None

class StructuredInput(BaseModel):
    id: str
    raw_content: str
    type: InputType
    status: Status
    entity: EntityTag
    summary: str
    risk_level: RiskLevel = RiskLevel.GREEN
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    tags: List[str] = []
