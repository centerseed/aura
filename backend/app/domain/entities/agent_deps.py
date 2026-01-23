"""AuraDeps: Agent execution dependencies for Pydantic AI.

This module defines the dependency injection container for Aura Agents.
All agents receive AuraDeps to access shared resources like Session Store
and MCP Manager.
"""

from dataclasses import dataclass
from typing import Optional
from app.domain.interfaces.session_interfaces import ISessionStore


@dataclass
class AuraDeps:
    """Dependencies injected into Pydantic AI agents.

    This dataclass encapsulates all shared resources needed by agents:
    - Session Store: For persisting conversation state
    - MCP Manager: For invoking MCP tools (Phase 2)
    - User Context: For multi-tenant isolation (Phase 2)

    Phase 1: Only session_store is implemented.
    Phase 2: Will add mcp_manager and user_id.

    Example:
        ```python
        deps = AuraDeps(
            session_store=memory_session_store,
            session_id="abc123"
        )

        result = await agent.run("user input", deps=deps)
        ```
    """

    session_store: ISessionStore
    session_id: str
    user_id: str = "default_user"  # Phase 1: single-user mode

    # Phase 2: MCP integration (placeholder for now)
    # mcp_manager: Optional[IMCPManager] = None
