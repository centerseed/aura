"""MCP Manager interfaces.

This module defines abstract interfaces for MCP server management.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

from pydantic_ai.mcp import MCPServer, Resource, ResourceTemplate, ServerCapabilities

from app.domain.entities.mcp_server_config import MCPServerConfig


class IMCPServerManager(ABC):
    """Interface for managing MCP server instances.

    This interface defines the contract for creating, configuring, and
    managing MCP server connections in a uniform way.
    """

    @abstractmethod
    async def register_server(self, config: MCPServerConfig) -> MCPServer:
        """Register and initialize an MCP server.

        Args:
            config: The server configuration.

        Returns:
            The initialized MCPServer instance.

        Raises:
            ValueError: If configuration is invalid.
            MCPConnectionError: If connection fails.
        """

    @abstractmethod
    async def unregister_server(self, server_id: str) -> None:
        """Unregister and close an MCP server connection.

        Args:
            server_id: ID of the server to unregister.

        Raises:
            MCPServerNotFoundError: If server not found.
        """

    @abstractmethod
    async def get_server(self, server_id: str) -> MCPServer:
        """Retrieve a registered MCP server instance.

        Args:
            server_id: ID of the server.

        Returns:
            The MCPServer instance.

        Raises:
            MCPServerNotFoundError: If server not found.
        """

    @abstractmethod
    async def list_servers(self) -> dict[str, MCPServer]:
        """List all registered MCP servers.

        Returns:
            Dictionary mapping server IDs to MCPServer instances.
        """

    @abstractmethod
    async def get_server_capabilities(self, server_id: str) -> ServerCapabilities:
        """Get capabilities of a registered server.

        Args:
            server_id: ID of the server.

        Returns:
            ServerCapabilities from the server.

        Raises:
            MCPServerNotFoundError: If server not found.
        """

    @abstractmethod
    async def list_server_tools(self, server_id: str) -> list[dict[str, Any]]:
        """List all tools available from a server.

        Args:
            server_id: ID of the server.

        Returns:
            List of tool definitions.

        Raises:
            MCPServerNotFoundError: If server not found.
        """

    @abstractmethod
    async def list_server_resources(self, server_id: str) -> list[Resource]:
        """List all resources available from a server.

        Args:
            server_id: ID of the server.

        Returns:
            List of resources.

        Raises:
            MCPServerNotFoundError: If server not found.
        """

    @abstractmethod
    async def call_server_tool(
        self, server_id: str, tool_name: str, args: dict[str, Any]
    ) -> Any:
        """Call a tool on a registered server.

        Args:
            server_id: ID of the server.
            tool_name: Name of the tool to call.
            args: Arguments for the tool.

        Returns:
            The tool result.

        Raises:
            MCPServerNotFoundError: If server not found.
            ToolCallError: If tool call fails.
        """

    @abstractmethod
    async def get_server_info(self, server_id: str) -> dict[str, Any]:
        """Get metadata about a server.

        Args:
            server_id: ID of the server.

        Returns:
            Dictionary with server info.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
