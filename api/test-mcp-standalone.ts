/**
 * Standalone MCP Server Test
 *
 * 直接啟動 MCP Server（不透過 Next.js）來測試核心功能
 */

import { createMcpServer } from './src/mcp/server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  console.log('[test] Starting standalone MCP server...');

  const server = createMcpServer({
    port: 3002,
    backendUrl: 'http://localhost:3002',
    logLevel: 'debug',
    rateLimits: {
      globalPerMinute: 1000,
      perUserPerMinute: 100,
      perUserWritePerMinute: 20,
      perUserQueryPerMinute: 30,
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log('[test] MCP server running on stdio');
  console.log('[test] Use MCP Inspector or Claude Code to connect');
}

main().catch((error) => {
  console.error('[test] Fatal error:', error);
  process.exit(1);
});
