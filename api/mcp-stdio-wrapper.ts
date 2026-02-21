/**
 * MCP stdio wrapper for agentdx lint
 *
 * This is a temporary wrapper that exposes the Zentropy MCP server
 * via stdio transport so agentdx can perform static analysis.
 *
 * NOT for production use.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./src/mcp/server";

async function main() {
  const server = createMcpServer({ port: 3002 });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
