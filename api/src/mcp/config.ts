/**
 * MCP Server Configuration
 *
 * When integrated into the Next.js API server, the MCP server
 * shares the same process and port. Configuration is simplified.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface McpConfig {
  /** Port of the host server (shared with Next.js) */
  port: number;
  /** Base URL for internal API calls (same server) */
  backendUrl: string;
  /** Log level for MCP audit logs */
  logLevel: LogLevel;
  /** Rate limit thresholds */
  rateLimits: {
    globalPerMinute: number;
    perUserPerMinute: number;
    perUserWritePerMinute: number;
    perUserQueryPerMinute: number;
  };
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  ) {
    return value;
  }
  return "info";
}

export function loadMcpConfig(): McpConfig {
  const port = parseInt(process.env.PORT || "3002", 10);

  return {
    port,
    backendUrl: `http://localhost:${port}`,
    logLevel: parseLogLevel(process.env.ZENTROPY_MCP_LOG_LEVEL),
    rateLimits: {
      globalPerMinute: 1000,
      perUserPerMinute: 100,
      perUserWritePerMinute: 20,
      perUserQueryPerMinute: 30,
    },
  };
}
