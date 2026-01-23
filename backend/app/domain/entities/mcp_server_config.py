"""MCP Server configuration entity.

This module defines the MCP server configuration value object.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class MCPTransportType(str, Enum):
    """Supported MCP transport types."""

    STDIO = "stdio"
    SSE = "sse"
    STREAMABLE_HTTP = "streamable_http"


@dataclass(frozen=True)
class MCPServerConfig:
    """Value object for MCP server configuration.

    Encapsulates all configuration needed to connect to and manage
    an MCP server, supporting multiple transport types.
    """

    server_id: str
    """Unique identifier for this MCP server instance."""

    transport_type: MCPTransportType
    """Type of transport to use for this server."""

    # STDIO transport fields
    command: Optional[str] = None
    """Command to execute (STDIO transport only)."""

    args: list[str] = field(default_factory=list)
    """Arguments for the command (STDIO transport only)."""

    # HTTP transport fields
    url: Optional[str] = None
    """URL endpoint (HTTP/SSE transport only)."""

    headers: Optional[dict[str, str]] = None
    """Optional HTTP headers for authentication."""

    # Common configuration
    tool_prefix: Optional[str] = None
    """Prefix to add to all tools from this server."""

    timeout: float = 5.0
    """Timeout in seconds for server initialization."""

    read_timeout: float = 300.0
    """Read timeout in seconds (5 minutes default)."""

    cache_tools: bool = True
    """Whether to cache tool list from server."""

    cache_resources: bool = True
    """Whether to cache resource list from server."""

    enabled: bool = True
    """Whether this server is enabled."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Optional metadata for the server."""

    def __post_init__(self) -> None:
        """Validate configuration consistency."""
        if self.transport_type == MCPTransportType.STDIO:
            if not self.command:
                raise ValueError("STDIO transport requires 'command'")
        elif self.transport_type in (MCPTransportType.SSE, MCPTransportType.STREAMABLE_HTTP):
            if not self.url:
                raise ValueError(f"{self.transport_type.value} transport requires 'url'")
