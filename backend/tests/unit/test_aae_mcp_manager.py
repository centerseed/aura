"""Unit tests for AAE MCP Manager service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic_ai import mcp

from app.application.services.aae_mcp_manager import AAEMCPManager
from app.domain.entities.mcp_server_config import MCPServerConfig, MCPTransportType
from app.domain.exceptions import (
    MCPServerAlreadyRegisteredError,
    MCPServerNotFoundError,
)


@pytest.fixture
def manager():
    """Create an AAEMCPManager instance."""
    return AAEMCPManager()


@pytest.fixture
def stdio_config():
    """Create a STDIO MCP server configuration."""
    return MCPServerConfig(
        server_id="python_mcp",
        transport_type=MCPTransportType.STDIO,
        command="python",
        args=["-m", "mcp_run_python", "stdio"],
    )


@pytest.fixture
def sse_config():
    """Create an SSE MCP server configuration."""
    return MCPServerConfig(
        server_id="local_sse",
        transport_type=MCPTransportType.SSE,
        url="http://localhost:3001/sse",
    )


class TestAAEMCPManager:
    """Test cases for AAE MCP Manager."""

    @pytest.mark.asyncio
    async def test_register_stdio_server(self, manager, stdio_config):
        """Should register a STDIO MCP server."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_stdio.return_value = mock_server

            server = await manager.register_server(stdio_config)

            assert server is not None
            mock_stdio.assert_called_once()

    @pytest.mark.asyncio
    async def test_register_sse_server(self, manager, sse_config):
        """Should register an SSE MCP server."""
        with patch.object(mcp, "MCPServerSSE") as mock_sse:
            mock_server = AsyncMock()
            mock_sse.return_value = mock_server

            server = await manager.register_server(sse_config)

            assert server is not None
            mock_sse.assert_called_once()

    @pytest.mark.asyncio
    async def test_register_duplicate_server(self, manager, stdio_config):
        """Should raise error when registering duplicate server ID."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_stdio.return_value = mock_server

            # Register first time
            await manager.register_server(stdio_config)

            # Try to register again with same ID
            with pytest.raises(MCPServerAlreadyRegisteredError):
                await manager.register_server(stdio_config)

    @pytest.mark.asyncio
    async def test_get_server(self, manager, stdio_config):
        """Should retrieve registered server."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            retrieved = await manager.get_server("python_mcp")

            assert retrieved is mock_server

    @pytest.mark.asyncio
    async def test_get_nonexistent_server(self, manager):
        """Should raise error when getting nonexistent server."""
        with pytest.raises(MCPServerNotFoundError):
            await manager.get_server("nonexistent")

    @pytest.mark.asyncio
    async def test_list_servers(self, manager, stdio_config, sse_config):
        """Should list all registered servers."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio, \
             patch.object(mcp, "MCPServerSSE") as mock_sse:
            mock_stdio_instance = AsyncMock()
            mock_sse_instance = AsyncMock()
            mock_stdio.return_value = mock_stdio_instance
            mock_sse.return_value = mock_sse_instance

            await manager.register_server(stdio_config)
            await manager.register_server(sse_config)

            servers = await manager.list_servers()

            assert len(servers) == 2
            assert "python_mcp" in servers
            assert "local_sse" in servers

    @pytest.mark.asyncio
    async def test_unregister_server(self, manager, stdio_config):
        """Should unregister a server."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_server.__aexit__ = AsyncMock()
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            await manager.unregister_server("python_mcp")

            with pytest.raises(MCPServerNotFoundError):
                await manager.get_server("python_mcp")

    @pytest.mark.asyncio
    async def test_unregister_nonexistent_server(self, manager):
        """Should raise error when unregistering nonexistent server."""
        with pytest.raises(MCPServerNotFoundError):
            await manager.unregister_server("nonexistent")

    @pytest.mark.asyncio
    async def test_get_server_capabilities(self, manager, stdio_config):
        """Should get server capabilities."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_capabilities = MagicMock()
            mock_server.capabilities = mock_capabilities
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            caps = await manager.get_server_capabilities("python_mcp")

            assert caps is mock_capabilities

    @pytest.mark.asyncio
    async def test_get_server_capabilities_nonexistent(self, manager):
        """Should raise error for nonexistent server."""
        with pytest.raises(MCPServerNotFoundError):
            await manager.get_server_capabilities("nonexistent")

    @pytest.mark.asyncio
    async def test_list_server_tools(self, manager, stdio_config):
        """Should list tools from server."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_tools = [
                MagicMock(name="tool1", inputSchema={}),
                MagicMock(name="tool2", inputSchema={}),
            ]
            mock_server.list_tools = AsyncMock(return_value=mock_tools)
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            tools = await manager.list_server_tools("python_mcp")

            assert len(tools) == 2
            mock_server.list_tools.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_server_resources(self, manager, stdio_config):
        """Should list resources from server."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_resources = [
                MagicMock(),
                MagicMock(),
            ]
            mock_server.list_resources = AsyncMock(return_value=mock_resources)
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            resources = await manager.list_server_resources("python_mcp")

            assert len(resources) == 2
            mock_server.list_resources.assert_called_once()

    @pytest.mark.asyncio
    async def test_call_server_tool(self, manager, stdio_config):
        """Should call a tool on the server."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_result = {"result": "success"}
            mock_server.direct_call_tool = AsyncMock(return_value=mock_result)
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            result = await manager.call_server_tool("python_mcp", "test_tool", {"arg": "value"})

            assert result == mock_result
            mock_server.direct_call_tool.assert_called_once_with(
                "test_tool", {"arg": "value"}
            )

    @pytest.mark.asyncio
    async def test_get_server_info(self, manager, stdio_config):
        """Should get server information."""
        with patch.object(mcp, "MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_server_info = MagicMock()
            mock_server_info.name = "Test MCP Server"
            mock_server_info.version = "1.0.0"
            mock_server.server_info = mock_server_info
            mock_stdio.return_value = mock_server

            await manager.register_server(stdio_config)
            info = await manager.get_server_info("python_mcp")

            assert info["server_id"] == "python_mcp"
            assert info["server_name"] == "Test MCP Server"
            assert info["transport_type"] == "stdio"
