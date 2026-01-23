"""Integration tests for AAE MCP Manager.

This module tests the complete MCP manager workflow with actual
(mocked) Pydantic AI MCP server integration.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.application.services.aae_mcp_manager import AAEMCPManager
from app.domain.entities.mcp_server_config import MCPTransportType
from app.infrastructure.mcp.mcp_server_factory import MCPServerFactory


@pytest.fixture
def mcp_manager():
    """Create an AAEMCPManager instance."""
    return AAEMCPManager()


class TestMCPManagerIntegration:
    """Integration tests for MCP Manager."""

    @pytest.mark.asyncio
    async def test_full_workflow_register_and_use_server(self, mcp_manager):
        """Should perform complete workflow: register, list tools, call tool, unregister."""
        with patch("pydantic_ai.mcp.MCPServerStdio") as mock_stdio:
            # Setup mock server
            mock_server = AsyncMock()
            tool1 = MagicMock()
            tool1.name = "execute"
            tool1.description = "Execute Python code"
            tool1.inputSchema = {}
            tool2 = MagicMock()
            tool2.name = "read_file"
            tool2.description = "Read a file"
            tool2.inputSchema = {}
            mock_tools = [tool1, tool2]
            mock_server.list_tools = AsyncMock(return_value=mock_tools)
            mock_server.direct_call_tool = AsyncMock(return_value={"result": "success"})
            mock_server_info = MagicMock()
            mock_server_info.name = "Python MCP"
            mock_server_info.version = "1.0.0"
            mock_server.server_info = mock_server_info
            mock_server.is_running = True
            mock_server.__aexit__ = AsyncMock()
            mock_stdio.return_value = mock_server

            # Create configuration
            config = MCPServerFactory.create_python_execution_server()

            # Register server
            registered = await mcp_manager.register_server(config)
            assert registered is mock_server

            # List servers
            servers = await mcp_manager.list_servers()
            assert "python_mcp" in servers

            # Get server info
            info = await mcp_manager.get_server_info("python_mcp")
            assert info["server_id"] == "python_mcp"
            assert info["server_name"] == "Python MCP"

            # List tools
            tools = await mcp_manager.list_server_tools("python_mcp")
            assert len(tools) == 2
            assert tools[0]["name"] == "execute"

            # Call a tool
            result = await mcp_manager.call_server_tool(
                "python_mcp",
                "execute",
                {"code": "print('hello')"}
            )
            assert result == {"result": "success"}

            # Unregister server
            await mcp_manager.unregister_server("python_mcp")
            assert len(await mcp_manager.list_servers()) == 0

    @pytest.mark.asyncio
    async def test_multiple_servers_management(self, mcp_manager):
        """Should manage multiple MCP servers simultaneously."""
        with patch("pydantic_ai.mcp.MCPServerStdio") as mock_stdio, \
             patch("pydantic_ai.mcp.MCPServerSSE") as mock_sse:

            # Create mock servers
            mock_stdio_server = AsyncMock()
            mock_sse_server = AsyncMock()
            mock_stdio.return_value = mock_stdio_server
            mock_sse.return_value = mock_sse_server

            # Register multiple servers
            stdio_config = MCPServerFactory.create_stdio_server(
                server_id="python_server",
                command="python",
                args=["-m", "mcp"],
            )
            sse_config = MCPServerFactory.create_sse_server(
                server_id="remote_server",
                url="http://localhost:3001/sse",
            )

            await mcp_manager.register_server(stdio_config)
            await mcp_manager.register_server(sse_config)

            # Verify both servers registered
            servers = await mcp_manager.list_servers()
            assert len(servers) == 2
            assert "python_server" in servers
            assert "remote_server" in servers

            # Verify correct types
            retrieved_stdio = await mcp_manager.get_server("python_server")
            retrieved_sse = await mcp_manager.get_server("remote_server")
            assert retrieved_stdio is mock_stdio_server
            assert retrieved_sse is mock_sse_server

    @pytest.mark.asyncio
    async def test_factory_to_manager_workflow(self, mcp_manager):
        """Should support convenient factory-to-manager workflow."""
        with patch("pydantic_ai.mcp.MCPServerStdio") as mock_stdio:
            mock_server = AsyncMock()
            mock_stdio.return_value = mock_server

            # Use factory to create config
            python_config = MCPServerFactory.create_python_execution_server(
                server_id="my_python"
            )
            assert python_config.tool_prefix == "python"

            # Register using config
            await mcp_manager.register_server(python_config)

            # Verify registration
            retrieved = await mcp_manager.get_server("my_python")
            assert retrieved is mock_server

    @pytest.mark.asyncio
    async def test_disabled_server_rejection(self, mcp_manager):
        """Should reject disabled servers on registration."""
        from app.domain.entities.mcp_server_config import MCPServerConfig

        disabled_config = MCPServerConfig(
            server_id="disabled",
            transport_type=MCPTransportType.STDIO,
            command="python",
            args=[],
            enabled=False,
        )

        with pytest.raises(ValueError, match="disabled"):
            await mcp_manager.register_server(disabled_config)
