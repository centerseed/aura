// Polyfill: Node.js v20 doesn't expose AsyncLocalStorage on globalThis,
// but Next.js internals expect it there when loaded outside of `next dev`.
import { AsyncLocalStorage } from "node:async_hooks";
(globalThis as any).AsyncLocalStorage = AsyncLocalStorage;

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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse } from "node:url";
import next from "next";

let versionInfo = { api: 0, mcp: 0 };
try {
  versionInfo = JSON.parse(readFileSync(join(__dirname, "version.json"), "utf-8"));
} catch {
  console.warn("[server] version.json not found, using default version 0");
}
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
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
const MAX_SESSIONS = 100;

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of mcpSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.transport.close?.();
      mcpSessions.delete(id);
    }
  }
}

/**
 * Extract Bearer token from Authorization header and attach as req.auth
 * so the MCP SDK passes it to tool handlers via extra.authInfo.
 */
function attachAuthInfo(req: import("node:http").IncomingMessage & { auth?: AuthInfo }) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    if (token) {
      req.auth = {
        token,
        clientId: "claude-code",
        scopes: [],
      };
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
            version: versionInfo,
            mcp: true,
            activeSessions: mcpSessions.size,
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // ── MCP Endpoint (Streamable HTTP) ────────────────
      if (pathname === "/mcp") {
        console.log(`[mcp] ${req.method} /mcp | auth header present: ${!!req.headers.authorization} | session: ${req.headers["mcp-session-id"] || "none"}`);
        // Check for existing session
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (sessionId && mcpSessions.has(sessionId)) {
          // Reuse existing session's transport
          const session = mcpSessions.get(sessionId)!;

          // Attach auth info to req so SDK passes it to tool handlers via extra.authInfo
          attachAuthInfo(req);
          await session.transport.handleRequest(req, res);
          return;
        }

        // Enforce session limit to prevent resource exhaustion
        if (mcpSessions.size >= MAX_SESSIONS) {
          cleanupStaleSessions();
          if (mcpSessions.size >= MAX_SESSIONS) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "too_many_sessions", message: "Server session limit reached. Try again later." }));
            return;
          }
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

        // Attach auth info to req so SDK passes it to tool handlers via extra.authInfo
        attachAuthInfo(req);
        await transport.handleRequest(req, res);

        // Store session for reuse
        const sid = transport.sessionId;
        if (sid) {
          mcpSessions.set(sid, { transport, createdAt: Date.now() });
        }
        return;
      }

      // ── OAuth root-level redirects (MCP SDK uses /authorize and /token) ──
      if (pathname === "/authorize") {
        const qs = parsedUrl.search || "";
        res.writeHead(302, { Location: `/api/oauth/mcp/authorize${qs}` });
        res.end();
        return;
      }
      if (pathname === "/token" && req.method === "POST") {
        // Proxy to Next.js route
        const nextUrl = parse(`/api/oauth/mcp/token${parsedUrl.search || ""}`, true);
        await handleNextRequest(req, res, nextUrl);
        return;
      }
      if (pathname === "/register") {
        // Dynamic client registration not supported
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "registration_not_supported" }));
        return;
      }

      // ── OAuth Protected Resource Metadata (RFC 9728, required by MCP clients) ──
      if (pathname === "/.well-known/oauth-protected-resource") {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${hostname}:${port}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            resource: `${baseUrl}/mcp`,
            authorization_servers: [baseUrl],
            scopes_supported: [
              "read:tasks",
              "read:knowledge",
              "read:profile",
              "write:inbox",
              "write:knowledge",
              "trigger:librarian",
            ],
          }),
        );
        return;
      }

      // ── OAuth Discovery (for MCP clients) ─────────────
      if (pathname === "/.well-known/oauth-authorization-server-metadata") {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${hostname}:${port}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
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

      // ── Catch unmatched OAuth discovery paths (return JSON, not HTML) ──
      if (pathname?.startsWith("/.well-known/") || pathname === "/register") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not_found" }));
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
