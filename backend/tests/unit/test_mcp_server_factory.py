"""Unit tests for MCP Server Factory."""

import pytest

from app.domain.entities.mcp_server_config import MCPTransportType
from app.infrastructure.mcp.mcp_server_factory import MCPServerFactory


class TestMCPServerFactory:
    """Test cases for MCPServerFactory."""

    def test_create_stdio_server(self):
        """Should create STDIO server configuration."""
        config = MCPServerFactory.create_stdio_server(
            server_id="test_server",
            command="python",
            args=["-m", "mcp_server"],
        )

        assert config.server_id == "test_server"
        assert config.transport_type == MCPTransportType.STDIO
        assert config.command == "python"
        assert config.args == ["-m", "mcp_server"]

    def test_create_stdio_server_with_prefix(self):
        """Should create STDIO server with tool prefix."""
        config = MCPServerFactory.create_stdio_server(
            server_id="test",
            command="python",
            tool_prefix="my_tools",
        )

        assert config.tool_prefix == "my_tools"

    def test_create_sse_server(self):
        """Should create SSE server configuration."""
        config = MCPServerFactory.create_sse_server(
            server_id="sse_server",
            url="http://localhost:3001/sse",
        )

        assert config.server_id == "sse_server"
        assert config.transport_type == MCPTransportType.SSE
        assert config.url == "http://localhost:3001/sse"

    def test_create_sse_server_with_headers(self):
        """Should create SSE server with auth headers."""
        headers = {"Authorization": "Bearer token123"}
        config = MCPServerFactory.create_sse_server(
            server_id="secure_sse",
            url="http://localhost:3001/sse",
            headers=headers,
        )

        assert config.headers == headers

    def test_create_streamable_http_server(self):
        """Should create Streamable HTTP server configuration."""
        config = MCPServerFactory.create_streamable_http_server(
            server_id="http_server",
            url="http://localhost:8000/mcp",
        )

        assert config.server_id == "http_server"
        assert config.transport_type == MCPTransportType.STREAMABLE_HTTP
        assert config.url == "http://localhost:8000/mcp"

    def test_create_python_execution_server(self):
        """Should create pre-configured Python execution server."""
        config = MCPServerFactory.create_python_execution_server()

        assert config.server_id == "python_mcp"
        assert config.transport_type == MCPTransportType.STDIO
        assert config.command == "uv"
        assert "mcp-run-python" in config.args
        assert config.tool_prefix == "python"

    def test_create_python_execution_server_custom_id(self):
        """Should create Python server with custom ID."""
        config = MCPServerFactory.create_python_execution_server(
            server_id="custom_python"
        )

        assert config.server_id == "custom_python"

    def test_create_filesystem_server(self):
        """Should create pre-configured filesystem server."""
        config = MCPServerFactory.create_filesystem_server()

        assert config.server_id == "filesystem_mcp"
        assert config.transport_type == MCPTransportType.STDIO
        assert config.command == "uv"
        assert "mcp-run-bash" in config.args
        assert config.tool_prefix == "fs"

    def test_create_filesystem_server_custom_id(self):
        """Should create filesystem server with custom ID."""
        config = MCPServerFactory.create_filesystem_server(
            server_id="my_filesystem"
        )

        assert config.server_id == "my_filesystem"

    def test_factory_defaults(self):
        """Should apply reasonable defaults."""
        config = MCPServerFactory.create_stdio_server(
            server_id="defaults",
            command="test",
        )

        assert config.timeout == 5.0
        assert config.read_timeout == 300.0
        assert config.cache_tools is True
        assert config.cache_resources is True

    def test_custom_timeouts(self):
        """Should support custom timeout values."""
        config = MCPServerFactory.create_sse_server(
            server_id="slow",
            url="http://localhost:3001/sse",
            timeout=30.0,
            read_timeout=600.0,
        )

        assert config.timeout == 30.0
        assert config.read_timeout == 600.0
