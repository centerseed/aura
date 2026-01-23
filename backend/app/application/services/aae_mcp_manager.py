"""AAE MCP Manager service.

This module implements the core MCP server management service for the
Aura Agent Ecosystem. It provides a unified interface for registering,
configuring, and managing MCP servers.
"""

from typing import Any, Optional

from pydantic_ai import mcp

from app.domain.entities.mcp_server_config import MCPServerConfig, MCPTransportType
from app.domain.exceptions import (
    MCPConnectionError,
    MCPServerAlreadyRegisteredError,
    MCPServerNotFoundError,
    MCPToolCallError,
)
from app.domain.interfaces.mcp_manager_interface import IMCPServerManager


class AAEMCPManager(IMCPServerManager):
    """Implementation of MCP server manager for Aura Agent Ecosystem.

    This service manages the lifecycle of MCP server connections, providing
    a unified interface for registering, accessing, and interacting with
    multiple MCP servers.
    """

    def __init__(self):
        """Initialize the MCP Manager."""
        self._servers: dict[str, mcp.MCPServer] = {}
        self._configs: dict[str, MCPServerConfig] = {}

    async def register_server(self, config: MCPServerConfig) -> mcp.MCPServer:
        """Register and initialize an MCP server.

        Args:
            config: The server configuration.

        Returns:
            The initialized MCPServer instance.

        Raises:
            ValueError: If configuration is invalid.
            MCPConnectionError: If connection fails.
            MCPServerAlreadyRegisteredError: If server ID already registered.
        """
        if config.server_id in self._servers:
            raise MCPServerAlreadyRegisteredError(config.server_id)

        if not config.enabled:
            raise ValueError(f"Server {config.server_id} is disabled")

        try:
            server = self._create_mcp_server(config)
            self._servers[config.server_id] = server
            self._configs[config.server_id] = config
            return server
        except Exception as e:
            raise MCPConnectionError(config.server_id, str(e)) from e

    async def unregister_server(self, server_id: str) -> None:
        """Unregister and close an MCP server connection.

        Args:
            server_id: ID of the server to unregister.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
        if server_id not in self._servers:
            raise MCPServerNotFoundError(server_id)

        server = self._servers.pop(server_id)
        self._configs.pop(server_id)

        # Gracefully close connection if running
        if hasattr(server, "is_running") and server.is_running:
            try:
                await server.__aexit__(None, None, None)
            except Exception:
                pass  # Best effort cleanup

    async def get_server(self, server_id: str) -> mcp.MCPServer:
        """Retrieve a registered MCP server instance.

        Args:
            server_id: ID of the server.

        Returns:
            The MCPServer instance.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
        if server_id not in self._servers:
            raise MCPServerNotFoundError(server_id)
        return self._servers[server_id]

    async def list_servers(self) -> dict[str, mcp.MCPServer]:
        """List all registered MCP servers.

        Returns:
            Dictionary mapping server IDs to MCPServer instances.
        """
        return dict(self._servers)

    async def get_server_capabilities(self, server_id: str) -> Any:
        """Get capabilities of a registered server.

        Args:
            server_id: ID of the server.

        Returns:
            ServerCapabilities from the server.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
        server = await self.get_server(server_id)
        return server.capabilities

    async def list_server_tools(self, server_id: str) -> list[dict[str, Any]]:
        """List all tools available from a server.

        Args:
            server_id: ID of the server.

        Returns:
            List of tool definitions.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
        server = await self.get_server(server_id)
        tools = await server.list_tools()
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema,
            }
            for tool in tools
        ]

    async def list_server_resources(self, server_id: str) -> list[Any]:
        """List all resources available from a server.

        Args:
            server_id: ID of the server.

        Returns:
            List of resources.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
        server = await self.get_server(server_id)
        return await server.list_resources()

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
            MCPToolCallError: If tool call fails.
        """
        try:
            server = await self.get_server(server_id)
            return await server.direct_call_tool(tool_name, args)
        except MCPServerNotFoundError:
            raise
        except Exception as e:
            raise MCPToolCallError(server_id, tool_name, str(e)) from e

    async def get_server_info(self, server_id: str) -> dict[str, Any]:
        """Get metadata about a server.

        Args:
            server_id: ID of the server.

        Returns:
            Dictionary with server info.

        Raises:
            MCPServerNotFoundError: If server not found.
        """
        server = await self.get_server(server_id)
        config = self._configs[server_id]

        server_info = server.server_info if hasattr(server, "server_info") else None

        return {
            "server_id": server_id,
            "transport_type": config.transport_type.value,
            "enabled": config.enabled,
            "tool_prefix": config.tool_prefix,
            "cache_tools": config.cache_tools,
            "cache_resources": config.cache_resources,
            "metadata": config.metadata,
            "server_name": server_info.name if server_info else None,
            "server_version": server_info.version if server_info else None,
        }

    def _create_mcp_server(self, config: MCPServerConfig) -> mcp.MCPServer:
        """Create an MCP server instance based on configuration.

        Args:
            config: The server configuration.

        Returns:
            The created MCPServer instance.

        Raises:
            ValueError: If transport type is invalid or config is missing required fields.
        """
        common_kwargs = {
            "tool_prefix": config.tool_prefix,
            "timeout": config.timeout,
            "read_timeout": config.read_timeout,
            "cache_tools": config.cache_tools,
            "cache_resources": config.cache_resources,
            "id": config.server_id,
        }

        if config.transport_type == MCPTransportType.STDIO:
            if not config.command:
                raise ValueError("STDIO transport requires 'command'")
            return mcp.MCPServerStdio(
                command=config.command,
                args=config.args or [],
                **common_kwargs,
            )

        elif config.transport_type == MCPTransportType.SSE:
            if not config.url:
                raise ValueError("SSE transport requires 'url'")
            return mcp.MCPServerSSE(
                url=config.url,
                headers=config.headers,
                **common_kwargs,
            )

        elif config.transport_type == MCPTransportType.STREAMABLE_HTTP:
            if not config.url:
                raise ValueError("STREAMABLE_HTTP transport requires 'url'")
            return mcp.MCPServerStreamableHTTP(
                url=config.url,
                headers=config.headers,
                **common_kwargs,
            )

        else:
            raise ValueError(f"Unsupported transport type: {config.transport_type}")
