"""Unit tests for MCPServerConfig entity."""

import pytest

from app.domain.entities.mcp_server_config import MCPServerConfig, MCPTransportType


class TestMCPServerConfig:
    """Test cases for MCPServerConfig value object."""

    def test_stdio_config_valid(self):
        """Should create valid STDIO configuration."""
        config = MCPServerConfig(
            server_id="python_server",
            transport_type=MCPTransportType.STDIO,
            command="python",
            args=["-m", "mcp_server"],
        )

        assert config.server_id == "python_server"
        assert config.transport_type == MCPTransportType.STDIO
        assert config.command == "python"
        assert config.args == ["-m", "mcp_server"]

    def test_stdio_config_missing_command(self):
        """Should raise ValueError when STDIO config lacks command."""
        with pytest.raises(ValueError, match="STDIO transport requires 'command'"):
            MCPServerConfig(
                server_id="bad_server",
                transport_type=MCPTransportType.STDIO,
                args=["-m", "mcp"],
            )

    def test_sse_config_valid(self):
        """Should create valid SSE configuration."""
        config = MCPServerConfig(
            server_id="sse_server",
            transport_type=MCPTransportType.SSE,
            url="http://localhost:3001/sse",
            headers={"Authorization": "Bearer token123"},
        )

        assert config.server_id == "sse_server"
        assert config.transport_type == MCPTransportType.SSE
        assert config.url == "http://localhost:3001/sse"
        assert config.headers == {"Authorization": "Bearer token123"}

    def test_sse_config_missing_url(self):
        """Should raise ValueError when SSE config lacks URL."""
        with pytest.raises(ValueError, match="sse transport requires 'url'"):
            MCPServerConfig(
                server_id="bad_sse",
                transport_type=MCPTransportType.SSE,
            )

    def test_streamable_http_config_valid(self):
        """Should create valid Streamable HTTP configuration."""
        config = MCPServerConfig(
            server_id="http_server",
            transport_type=MCPTransportType.STREAMABLE_HTTP,
            url="http://localhost:8000/mcp",
        )

        assert config.transport_type == MCPTransportType.STREAMABLE_HTTP
        assert config.url == "http://localhost:8000/mcp"

    def test_config_with_tool_prefix(self):
        """Should support tool prefix in configuration."""
        config = MCPServerConfig(
            server_id="prefixed_server",
            transport_type=MCPTransportType.STDIO,
            command="python",
            args=["-m", "mcp"],
            tool_prefix="my_tools",
        )

        assert config.tool_prefix == "my_tools"

    def test_config_with_custom_timeouts(self):
        """Should support custom timeout settings."""
        config = MCPServerConfig(
            server_id="slow_server",
            transport_type=MCPTransportType.SSE,
            url="http://localhost:3001/sse",
            timeout=30.0,
            read_timeout=600.0,
        )

        assert config.timeout == 30.0
        assert config.read_timeout == 600.0

    def test_config_with_caching_options(self):
        """Should support cache control settings."""
        config = MCPServerConfig(
            server_id="dynamic_server",
            transport_type=MCPTransportType.SSE,
            url="http://localhost:3001/sse",
            cache_tools=False,
            cache_resources=False,
        )

        assert config.cache_tools is False
        assert config.cache_resources is False

    def test_config_disabled_server(self):
        """Should support disabled servers."""
        config = MCPServerConfig(
            server_id="disabled_server",
            transport_type=MCPTransportType.STDIO,
            command="python",
            args=["-m", "mcp"],
            enabled=False,
        )

        assert config.enabled is False

    def test_config_with_metadata(self):
        """Should support optional metadata."""
        metadata = {"version": "1.0", "provider": "custom"}
        config = MCPServerConfig(
            server_id="metadata_server",
            transport_type=MCPTransportType.SSE,
            url="http://localhost:3001/sse",
            metadata=metadata,
        )

        assert config.metadata == metadata

    def test_config_is_frozen(self):
        """Should create immutable configuration."""
        config = MCPServerConfig(
            server_id="immutable",
            transport_type=MCPTransportType.STDIO,
            command="python",
            args=["-m", "mcp"],
        )

        with pytest.raises(AttributeError):
            config.server_id = "modified"

    def test_config_default_values(self):
        """Should apply reasonable defaults."""
        config = MCPServerConfig(
            server_id="defaults",
            transport_type=MCPTransportType.SSE,
            url="http://localhost:3001/sse",
        )

        assert config.timeout == 5.0
        assert config.read_timeout == 300.0
        assert config.cache_tools is True
        assert config.cache_resources is True
        assert config.enabled is True
        assert config.metadata == {}
