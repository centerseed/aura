"""Session State entity for managing user conversation state.

This module defines the SessionState entity used to maintain conversation
history and working memory across multiple agent interactions.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List
from app.domain.entities.input_entity import StructuredInput


class SessionState(BaseModel):
    """User session state containing conversation history.

    Attributes:
        session_id: Unique identifier for the session
        user_id: User identifier (default "default_user" for Phase 1 single-user mode)
        conversation_history: List of all structured inputs in this session
        created_at: Timestamp when session was created
        updated_at: Timestamp when session was last modified
    """

    session_id: str
    user_id: str = "default_user"  # Phase 1: single-user mode
    conversation_history: List[StructuredInput] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
