"""Unit tests for SessionState entity.

Tests the core Session data model used to maintain user conversation state.
"""

import pytest
from datetime import datetime
from app.domain.entities.session_entity import SessionState
from app.domain.entities.input_entity import StructuredInput, InputType, Status, EntityTag, RiskLevel


class TestSessionState:
    """Test suite for SessionState entity."""

    def test_create_session_with_minimal_fields(self):
        """Should create a session with only required fields."""
        session = SessionState(
            session_id="test-session-123",
            user_id="user-456"
        )

        assert session.session_id == "test-session-123"
        assert session.user_id == "user-456"
        assert session.conversation_history == []
        assert isinstance(session.created_at, datetime)
        assert isinstance(session.updated_at, datetime)

    def test_create_session_with_default_user(self):
        """Should use default user ID when not specified (Phase 1 behavior)."""
        session = SessionState(session_id="test-session-123")

        assert session.user_id == "default_user"

    def test_create_session_with_conversation_history(self):
        """Should create a session with existing conversation history."""
        structured_input = StructuredInput(
            id="input-1",
            raw_content="測試輸入",
            type=InputType.ACTION,
            status=Status.ACTIVE,
            entity=EntityTag(area="Test"),
            summary="測試摘要"
        )

        session = SessionState(
            session_id="test-session-123",
            user_id="user-456",
            conversation_history=[structured_input]
        )

        assert len(session.conversation_history) == 1
        assert session.conversation_history[0].id == "input-1"

    def test_session_model_dump(self):
        """Should serialize session to dict for storage."""
        session = SessionState(
            session_id="test-session-123",
            user_id="user-456"
        )

        session_dict = session.model_dump()

        assert session_dict["session_id"] == "test-session-123"
        assert session_dict["user_id"] == "user-456"
        assert "created_at" in session_dict
        assert "updated_at" in session_dict
        assert session_dict["conversation_history"] == []

    def test_session_model_validate(self):
        """Should deserialize dict to SessionState object."""
        session_data = {
            "session_id": "test-session-123",
            "user_id": "user-456",
            "conversation_history": [],
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }

        session = SessionState.model_validate(session_data)

        assert session.session_id == "test-session-123"
        assert session.user_id == "user-456"
        assert session.conversation_history == []

    def test_timestamps_auto_generated(self):
        """Should automatically generate timestamps on creation."""
        before = datetime.now()
        session = SessionState(session_id="test-session-123")
        after = datetime.now()

        assert before <= session.created_at <= after
        assert before <= session.updated_at <= after
