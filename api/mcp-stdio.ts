#!/usr/bin/env node
/**
 * Zentropy MCP Server (stdio mode)
 *
 * 用於 Claude Code 本地整合測試
 * 執行方式：npx tsx api/mcp-stdio.ts
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './src/mcp/server.js';

async function main() {
  // 開發模式：不需要 JWT secret
  // auth-middleware 會自動使用 dev-user context
  if (!process.env.ZENTROPY_MCP_JWT_SECRET) {
    console.error('[mcp] Running in DEV mode (no JWT verification)');
  }

  const server = createMcpServer({
    port: 3002,
    backendUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
    logLevel: 'info',
    rateLimits: {
      globalPerMinute: 1000,
      perUserPerMinute: 100,
      perUserWritePerMinute: 20,
      perUserQueryPerMinute: 30,
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[mcp] Zentropy MCP Server ready (stdio)');
}

main().catch((error) => {
  console.error('[mcp] Fatal error:', error);
  process.exit(1);
});
