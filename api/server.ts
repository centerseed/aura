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
import { prisma } from "./src/lib/db";

let versionInfo = { api: 0, mcp: 0 };
try {
  versionInfo = JSON.parse(readFileSync(join(__dirname, "version.json"), "utf-8"));
} catch {
  console.warn("[server] version.json not found, using default version 0");
}
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpServer } from "./src/mcp/server";
import { extractMcpAccessToken } from "./src/mcp/security/http-token";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3002", 10);

/**
 * MCP runs in stateless mode — no in-memory session store.
 * Each request creates a fresh McpServer + transport, so Cloud Run
 * cold starts and scale-to-zero never cause "session_not_found" errors.
 * Auth is handled per-request via Bearer token (stored in DB).
 */

/**
 * Extract Bearer token from Authorization header and attach as req.auth
 * so the MCP SDK passes it to tool handlers via extra.authInfo.
 */
function attachAuthInfo(req: import("node:http").IncomingMessage & { auth?: AuthInfo }) {
  const token = extractMcpAccessToken(req);
  if (token) {
    req.auth = {
      token,
      clientId: "mcp-client",
      scopes: [],
    };
  }
}

async function main() {
  // 1. Prepare Next.js
  const app = next({ dev, hostname, port });
  const handleNextRequest = app.getRequestHandler();
  await app.prepare();

  console.log(`[server] Starting Zentropy API + MCP Server (stateless mode)...`);

  // 3. Create unified HTTP server
  const httpServer = createHttpServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "/", true);
      const pathname = parsedUrl.pathname || "/";

      // ── Health Check ──────────────────────────────────
      if (pathname === "/health") {
        let dbStatus = "ok";
        let dbLatencyMs: number | null = null;
        try {
          const t0 = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          dbLatencyMs = Date.now() - t0;
        } catch (err) {
          dbStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
        }
        const healthy = dbStatus === "ok";
        res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: healthy ? "ok" : "degraded",
            service: "zentropy-api",
            version: versionInfo,
            db: dbStatus,
            dbLatencyMs,
            mcp: true,
            mcpMode: "stateless",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // ── MCP Endpoint (Stateless Streamable HTTP) ──────
      if (pathname === "/mcp") {
        console.log(`[mcp] ${req.method} /mcp | auth header present: ${!!req.headers.authorization}`);

        // Stateless: each request gets a fresh McpServer + transport
        const mcpServer = createMcpServer({ port });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless — no session tracking
        });

        transport.onclose = () => mcpServer.close();

        await mcpServer.connect(transport);
        attachAuthInfo(req);
        await transport.handleRequest(req, res);
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
      // RFC 8414 標準路徑（不含 -metadata 後綴）
      if (pathname === "/.well-known/oauth-authorization-server") {
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
