#!/usr/bin/env node

/**
 * Zentropy MCP Server Entry Point
 *
 * Supports two transport modes (Section 6.2):
 * - stdio: For Claude Code / Claude Desktop local mode
 * - http: Streamable HTTP for remote mode (Cloud Run deployment)
 *
 * Usage:
 *   zentropy-mcp-server                    # default: stdio
 *   zentropy-mcp-server --transport=stdio  # explicit stdio
 *   zentropy-mcp-server --transport=http   # HTTP mode
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createHttpServer } from "node:http";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);

  if (config.transport === "http") {
    await startHttpTransport(server, config.port);
  } else {
    await startStdioTransport(server);
  }
}

async function startStdioTransport(
  server: ReturnType<typeof createServer>,
): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    JSON.stringify({
      level: "info",
      type: "mcp_startup",
      message: "Zentropy MCP Server started (stdio transport)",
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
}

async function startHttpTransport(
  server: ReturnType<typeof createServer>,
  port: number,
): Promise<void> {
  const httpServer = createHttpServer(async (req, res) => {
    // Health check endpoint
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", transport: "http" }));
      return;
    }

    // OAuth metadata discovery endpoint (Section 2.2.1)
    if (
      req.method === "GET" &&
      req.url === "/.well-known/oauth-authorization-server-metadata"
    ) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          issuer: process.env.ZENTROPY_OAUTH_ISSUER || "https://auth.zentropy.app",
          authorization_endpoint:
            (process.env.ZENTROPY_OAUTH_ISSUER || "https://auth.zentropy.app") +
            "/authorize",
          token_endpoint:
            (process.env.ZENTROPY_OAUTH_ISSUER || "https://auth.zentropy.app") +
            "/token",
          registration_endpoint:
            (process.env.ZENTROPY_OAUTH_ISSUER || "https://auth.zentropy.app") +
            "/register",
          scopes_supported: [
            "read:tasks",
            "read:knowledge",
            "read:profile",
            "write:inbox",
            "write:knowledge",
            "trigger:librarian",
          ],
          response_types_supported: ["code"],
          grant_types_supported: [
            "authorization_code",
            "refresh_token",
          ],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "none",
          ],
        }),
      );
      return;
    }

    // MCP endpoint — handle via Streamable HTTP transport
    if (req.url === "/mcp" || req.url?.startsWith("/mcp")) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    // 404 for unknown paths
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  httpServer.listen(port, () => {
    process.stderr.write(
      JSON.stringify({
        level: "info",
        type: "mcp_startup",
        message: `Zentropy MCP Server started (HTTP transport on port ${port})`,
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
  });

  // Graceful shutdown
  const shutdown = () => {
    process.stderr.write(
      JSON.stringify({
        level: "info",
        type: "mcp_shutdown",
        message: "Zentropy MCP Server shutting down",
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      level: "error",
      type: "mcp_fatal",
      message: `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
  process.exit(1);
});
