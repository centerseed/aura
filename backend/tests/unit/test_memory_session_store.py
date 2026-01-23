"""Unit tests for MemorySessionStore.

Tests the in-memory implementation of ISessionStore interface.
This is Phase 1 implementation - Phase 2 will upgrade to Firestore.
"""

import pytest
from app.domain.entities.session_entity import SessionState
from app.domain.exceptions import SessionNotFoundError, SessionAlreadyExistsError
from app.infrastructure.persistence.memory_session_store import MemorySessionStore


class TestMemorySessionStore:
    """Test suite for MemorySessionStore."""

    @pytest.fixture
    def store(self):
        """Create a fresh MemorySessionStore for each test."""
        return MemorySessionStore()

    @pytest.fixture
    def sample_session(self):
        """Create a sample session for testing."""
        return SessionState(
            session_id="test-session-123",
            user_id="user-456"
        )

    @pytest.mark.asyncio
    async def test_create_session(self, store, sample_session):
        """Should successfully create a new session."""
        await store.create_session(sample_session)

        retrieved = await store.get_session("test-session-123")
        assert retrieved is not None
        assert retrieved.session_id == "test-session-123"
        assert retrieved.user_id == "user-456"

    @pytest.mark.asyncio
    async def test_create_duplicate_session_raises_error(self, store, sample_session):
        """Should raise SessionAlreadyExistsError when creating duplicate session."""
        await store.create_session(sample_session)

        with pytest.raises(SessionAlreadyExistsError) as exc_info:
            await store.create_session(sample_session)

        assert "test-session-123" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_nonexistent_session_returns_none(self, store):
        """Should return None when retrieving non-existent session."""
        result = await store.get_session("nonexistent-session")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_session(self, store, sample_session):
        """Should successfully update an existing session."""
        await store.create_session(sample_session)

        # Modify session
        sample_session.user_id = "updated-user"
        await store.update_session(sample_session)

        # Verify update
        retrieved = await store.get_session("test-session-123")
        assert retrieved.user_id == "updated-user"

    @pytest.mark.asyncio
    async def test_update_nonexistent_session_raises_error(self, store, sample_session):
        """Should raise SessionNotFoundError when updating non-existent session."""
        with pytest.raises(SessionNotFoundError) as exc_info:
            await store.update_session(sample_session)

        assert "test-session-123" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_session(self, store, sample_session):
        """Should successfully delete an existing session."""
        await store.create_session(sample_session)
        await store.delete_session("test-session-123")

        result = await store.get_session("test-session-123")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_session_raises_error(self, store):
        """Should raise SessionNotFoundError when deleting non-existent session."""
        with pytest.raises(SessionNotFoundError) as exc_info:
            await store.delete_session("nonexistent-session")

        assert "nonexistent-session" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_session_exists(self, store, sample_session):
        """Should correctly check session existence."""
        assert await store.session_exists("test-session-123") is False

        await store.create_session(sample_session)
        assert await store.session_exists("test-session-123") is True

        await store.delete_session("test-session-123")
        assert await store.session_exists("test-session-123") is False

    @pytest.mark.asyncio
    async def test_concurrent_access_thread_safety(self, store):
        """Should handle concurrent access safely (basic test)."""
        import asyncio

        sessions = [
            SessionState(session_id=f"session-{i}", user_id=f"user-{i}")
            for i in range(10)
        ]

        # Create sessions concurrently
        await asyncio.gather(*[store.create_session(s) for s in sessions])

        # Verify all sessions exist
        for i in range(10):
            exists = await store.session_exists(f"session-{i}")
            assert exists is True
