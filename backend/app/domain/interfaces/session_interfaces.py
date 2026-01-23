"""Session Store interface defining session persistence behavior.

This module defines the abstract interface for session storage implementations.
Phase 1 uses in-memory storage, Phase 2 upgrades to Firestore persistence.
"""

from abc import ABC, abstractmethod
from typing import Optional
from app.domain.entities.session_entity import SessionState


class ISessionStore(ABC):
    """Abstract interface for session persistence.

    Implementations must provide methods for storing, retrieving, and
    managing user session state.
    """

    @abstractmethod
    async def create_session(self, session: SessionState) -> None:
        """Create a new session in the store.

        Args:
            session: SessionState object to persist

        Raises:
            SessionAlreadyExistsError: If session_id already exists
        """
        pass

    @abstractmethod
    async def get_session(self, session_id: str) -> Optional[SessionState]:
        """Retrieve a session by its ID.

        Args:
            session_id: Unique session identifier

        Returns:
            SessionState if found, None otherwise
        """
        pass

    @abstractmethod
    async def update_session(self, session: SessionState) -> None:
        """Update an existing session.

        Args:
            session: SessionState with updated data

        Raises:
            SessionNotFoundError: If session doesn't exist
        """
        pass

    @abstractmethod
    async def delete_session(self, session_id: str) -> None:
        """Delete a session from the store.

        Args:
            session_id: Unique session identifier

        Raises:
            SessionNotFoundError: If session doesn't exist
        """
        pass

    @abstractmethod
    async def session_exists(self, session_id: str) -> bool:
        """Check if a session exists.

        Args:
            session_id: Unique session identifier

        Returns:
            True if session exists, False otherwise
        """
        pass
