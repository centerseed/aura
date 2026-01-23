"""Factory for creating MCP server configurations.

This module provides a convenient factory class for creating MCP server
configurations with sensible defaults for common scenarios.
"""

from app.domain.entities.mcp_server_config import MCPServerConfig, MCPTransportType


class MCPServerFactory:
    """Factory for creating MCP server configurations."""

    @staticmethod
    def create_stdio_server(
        server_id: str,
        command: str,
        args: list[str] = None,
        tool_prefix: str = None,
        timeout: float = 5.0,
        read_timeout: float = 300.0,
    ) -> MCPServerConfig:
        """Create a STDIO MCP server configuration.

        Args:
            server_id: Unique identifier for the server.
            command: Command to execute.
            args: Command arguments.
            tool_prefix: Optional prefix for all tools.
            timeout: Initialization timeout in seconds.
            read_timeout: Read timeout in seconds.

        Returns:
            MCPServerConfig with STDIO transport.
        """
        return MCPServerConfig(
            server_id=server_id,
            transport_type=MCPTransportType.STDIO,
            command=command,
            args=args or [],
            tool_prefix=tool_prefix,
            timeout=timeout,
            read_timeout=read_timeout,
        )

    @staticmethod
    def create_sse_server(
        server_id: str,
        url: str,
        headers: dict[str, str] = None,
        tool_prefix: str = None,
        timeout: float = 5.0,
        read_timeout: float = 300.0,
    ) -> MCPServerConfig:
        """Create an SSE MCP server configuration.

        Args:
            server_id: Unique identifier for the server.
            url: Server endpoint URL.
            headers: Optional HTTP headers for authentication.
            tool_prefix: Optional prefix for all tools.
            timeout: Initialization timeout in seconds.
            read_timeout: Read timeout in seconds.

        Returns:
            MCPServerConfig with SSE transport.
        """
        return MCPServerConfig(
            server_id=server_id,
            transport_type=MCPTransportType.SSE,
            url=url,
            headers=headers,
            tool_prefix=tool_prefix,
            timeout=timeout,
            read_timeout=read_timeout,
        )

    @staticmethod
    def create_streamable_http_server(
        server_id: str,
        url: str,
        headers: dict[str, str] = None,
        tool_prefix: str = None,
        timeout: float = 5.0,
        read_timeout: float = 300.0,
    ) -> MCPServerConfig:
        """Create a Streamable HTTP MCP server configuration.

        Args:
            server_id: Unique identifier for the server.
            url: Server endpoint URL.
            headers: Optional HTTP headers for authentication.
            tool_prefix: Optional prefix for all tools.
            timeout: Initialization timeout in seconds.
            read_timeout: Read timeout in seconds.

        Returns:
            MCPServerConfig with Streamable HTTP transport.
        """
        return MCPServerConfig(
            server_id=server_id,
            transport_type=MCPTransportType.STREAMABLE_HTTP,
            url=url,
            headers=headers,
            tool_prefix=tool_prefix,
            timeout=timeout,
            read_timeout=read_timeout,
        )

    @staticmethod
    def create_python_execution_server(
        server_id: str = "python_mcp",
        tool_prefix: str = "python",
    ) -> MCPServerConfig:
        """Create a pre-configured Python execution MCP server.

        Uses mcp-run-python for sandboxed Python code execution.

        Args:
            server_id: Unique identifier for the server.
            tool_prefix: Prefix for tools (default: "python").

        Returns:
            MCPServerConfig for Python execution server.
        """
        return MCPServerFactory.create_stdio_server(
            server_id=server_id,
            command="uv",
            args=["run", "mcp-run-python", "stdio"],
            tool_prefix=tool_prefix,
        )

    @staticmethod
    def create_filesystem_server(
        server_id: str = "filesystem_mcp",
        tool_prefix: str = "fs",
    ) -> MCPServerConfig:
        """Create a pre-configured filesystem MCP server.

        Uses mcp-run-bash for file system operations.

        Args:
            server_id: Unique identifier for the server.
            tool_prefix: Prefix for tools (default: "fs").

        Returns:
            MCPServerConfig for filesystem server.
        """
        return MCPServerFactory.create_stdio_server(
            server_id=server_id,
            command="uv",
            args=["run", "mcp-run-bash", "stdio"],
            tool_prefix=tool_prefix,
        )
