/**
 * Zentropy Custom Server
 *
 * Serves both the Next.js API routes and the MCP endpoint
 * on a single port. This avoids deploying two separate services.
 *
 * Routes:
 *   /mcp     → MCP Streamable HTTP (for Claude Code, Cursor, etc.)
 *   /health  → Health check
 *   /*       → Next.js (all existing API routes)
 *
 * Usage:
 *   Development: npx tsx watch server.ts
 *   Production:  node --import tsx/esm server.ts
 */

import { createServer as createHttpServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./src/mcp/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3002", 10);

/**
 * Session management for MCP connections.
 * Each session gets its own McpServer + transport pair because
 * McpServer.connect() replaces the previous transport (no concurrency support).
 */
const mcpSessions = new Map<
  string,
  { transport: StreamableHTTPServerTransport; createdAt: number }
>();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of mcpSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.transport.close?.();
      mcpSessions.delete(id);
    }
  }
}

async function main() {
  // 1. Prepare Next.js
  const app = next({ dev, hostname, port });
  const handleNextRequest = app.getRequestHandler();
  await app.prepare();

  console.log(`[server] Starting Zentropy API + MCP Server...`);

  // Periodic session cleanup (every 5 minutes)
  const cleanupInterval = setInterval(cleanupStaleSessions, 5 * 60 * 1000);
  cleanupInterval.unref();

  // 3. Create unified HTTP server
  const httpServer = createHttpServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "/", true);
      const pathname = parsedUrl.pathname || "/";

      // ── Health Check ──────────────────────────────────
      if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            service: "zentropy-api",
            mcp: true,
            activeSessions: mcpSessions.size,
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // ── MCP Endpoint (Streamable HTTP) ────────────────
      if (pathname === "/mcp") {
        // Check for existing session
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (sessionId && mcpSessions.has(sessionId)) {
          // Reuse existing session's transport
          const session = mcpSessions.get(sessionId)!;
          await session.transport.handleRequest(req, res);
          return;
        }

        // New session: create dedicated McpServer + transport
        const mcpServer = createMcpServer({ port });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        // Clean up when transport closes
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) mcpSessions.delete(sid);
          mcpServer.close();
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);

        // Store session for reuse
        const sid = transport.sessionId;
        if (sid) {
          mcpSessions.set(sid, { transport, createdAt: Date.now() });
        }
        return;
      }

      // ── OAuth Discovery (for MCP clients) ─────────────
      if (pathname === "/.well-known/oauth-authorization-server-metadata") {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${hostname}:${port}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/api/oauth/mcp/authorize`,
            token_endpoint: `${baseUrl}/api/oauth/mcp/token`,
            scopes_supported: [
              "read:tasks",
              "read:knowledge",
              "read:profile",
              "write:inbox",
              "write:knowledge",
              "trigger:librarian",
            ],
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"],
          }),
        );
        return;
      }

      // ── Next.js handles everything else ───────────────
      await handleNextRequest(req, res, parsedUrl);
    } catch (error) {
      console.error("[server] Unhandled request error:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal_server_error" }));
      }
    }
  });

  httpServer.listen(port, () => {
    console.log(`[server] Zentropy API ready on http://${hostname}:${port}`);
    console.log(`   MCP endpoint: http://${hostname}:${port}/mcp`);
    console.log(`   Health check: http://${hostname}:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[server] Shutting down...");
    // Close all MCP sessions
    for (const [id, session] of mcpSessions) {
      session.transport.close?.();
      mcpSessions.delete(id);
    }
    httpServer.close(() => {
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[server] Fatal error:", error);
  process.exit(1);
});
