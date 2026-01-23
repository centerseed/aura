"""Unit tests for AuraDeps.

Tests the dependency injection container for Pydantic AI agents.
"""

import pytest
from app.domain.entities.agent_deps import AuraDeps
from app.infrastructure.persistence.memory_session_store import MemorySessionStore


class TestAuraDeps:
    """Test suite for AuraDeps."""

    @pytest.fixture
    def session_store(self):
        """Create a MemorySessionStore for testing."""
        return MemorySessionStore()

    def test_create_aura_deps_with_all_fields(self, session_store):
        """Should create AuraDeps with all required fields."""
        deps = AuraDeps(
            session_store=session_store,
            session_id="test-session-123",
            user_id="user-456"
        )

        assert deps.session_store == session_store
        assert deps.session_id == "test-session-123"
        assert deps.user_id == "user-456"

    def test_create_aura_deps_with_default_user(self, session_store):
        """Should use default_user when user_id not specified."""
        deps = AuraDeps(
            session_store=session_store,
            session_id="test-session-123"
        )

        assert deps.user_id == "default_user"

    def test_aura_deps_is_dataclass(self, session_store):
        """Should be a dataclass (for Pydantic AI compatibility)."""
        from dataclasses import is_dataclass

        deps = AuraDeps(
            session_store=session_store,
            session_id="test-session-123"
        )

        assert is_dataclass(deps)
        assert is_dataclass(AuraDeps)

    def test_aura_deps_immutable_after_creation(self, session_store):
        """Should allow modification (dataclass is mutable by default)."""
        deps = AuraDeps(
            session_store=session_store,
            session_id="test-session-123"
        )

        # Dataclasses are mutable, can change values
        deps.session_id = "new-session"
        assert deps.session_id == "new-session"
