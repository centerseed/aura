"""In-memory implementation of ISessionStore.

This is Phase 1 implementation using Python dict with threading locks.
Phase 2 will upgrade to Firestore persistence.

WARNING: This implementation loses all data when the process restarts.
Only suitable for local development and testing.
"""

import asyncio
from typing import Dict, Optional
from app.domain.interfaces.session_interfaces import ISessionStore
from app.domain.entities.session_entity import SessionState
from app.domain.exceptions import SessionNotFoundError, SessionAlreadyExistsError


class MemorySessionStore(ISessionStore):
    """In-memory session storage using Python dict.

    Thread-safe implementation using asyncio locks.
    Data is lost when process terminates.
    """

    def __init__(self):
        """Initialize empty session store with lock."""
        self._sessions: Dict[str, SessionState] = {}
        self._lock = asyncio.Lock()

    async def create_session(self, session: SessionState) -> None:
        """Create a new session in memory.

        Args:
            session: SessionState object to persist

        Raises:
            SessionAlreadyExistsError: If session_id already exists
        """
        async with self._lock:
            if session.session_id in self._sessions:
                raise SessionAlreadyExistsError(session.session_id)

            # Store a copy to avoid external mutations
            self._sessions[session.session_id] = session.model_copy(deep=True)

    async def get_session(self, session_id: str) -> Optional[SessionState]:
        """Retrieve a session by its ID.

        Args:
            session_id: Unique session identifier

        Returns:
            SessionState if found, None otherwise
        """
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None

            # Return a copy to prevent external mutations
            return session.model_copy(deep=True)

    async def update_session(self, session: SessionState) -> None:
        """Update an existing session.

        Args:
            session: SessionState with updated data

        Raises:
            SessionNotFoundError: If session doesn't exist
        """
        async with self._lock:
            if session.session_id not in self._sessions:
                raise SessionNotFoundError(session.session_id)

            # Update with a copy
            self._sessions[session.session_id] = session.model_copy(deep=True)

    async def delete_session(self, session_id: str) -> None:
        """Delete a session from memory.

        Args:
            session_id: Unique session identifier

        Raises:
            SessionNotFoundError: If session doesn't exist
        """
        async with self._lock:
            if session_id not in self._sessions:
                raise SessionNotFoundError(session_id)

            del self._sessions[session_id]

    async def session_exists(self, session_id: str) -> bool:
        """Check if a session exists.

        Args:
            session_id: Unique session identifier

        Returns:
            True if session exists, False otherwise
        """
        async with self._lock:
            return session_id in self._sessions
