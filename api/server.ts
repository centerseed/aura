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

async function main() {
  // 1. Prepare Next.js
  const app = next({ dev, hostname, port });
  const handleNextRequest = app.getRequestHandler();
  await app.prepare();

  // 2. Create MCP server (singleton)
  const mcpServer = createMcpServer({ port });

  console.log(`🚀 [server] Starting Zentropy API + MCP Server...`);

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
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // ── MCP Endpoint (Streamable HTTP) ────────────────
      if (pathname === "/mcp") {
        // Each request gets its own transport for stateless handling
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      // ── OAuth Discovery (for MCP clients) ─────────────
      if (pathname === "/.well-known/oauth-authorization-server-metadata") {
        const issuer =
          process.env.ZENTROPY_OAUTH_ISSUER || "https://auth.zentropy.app";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            registration_endpoint: `${issuer}/register`,
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
            token_endpoint_auth_methods_supported: [
              "client_secret_basic",
              "none",
            ],
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
    console.log(`✅ [server] Zentropy API ready on http://${hostname}:${port}`);
    console.log(`   📡 MCP endpoint: http://${hostname}:${port}/mcp`);
    console.log(`   🏥 Health check: http://${hostname}:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n🛑 [server] Shutting down...");
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
  console.error("❌ [server] Fatal error:", error);
  process.exit(1);
});
