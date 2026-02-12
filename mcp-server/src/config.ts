/**
 * Zentropy MCP Server Configuration
 *
 * All sensitive values are read from environment variables.
 * Never hardcode secrets in this file.
 */

export type TransportMode = "stdio" | "http";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ServerConfig {
  transport: TransportMode;
  port: number;
  backendUrl: string;
  accessToken: string | undefined;
  oauth: {
    issuer: string;
    clientId: string;
    audience: string;
  };
  logLevel: LogLevel;
  rateLimits: {
    globalPerMinute: number;
    perUserPerMinute: number;
    perUserWritePerMinute: number;
    perUserQueryPerMinute: number;
  };
}

function parseTransport(value: string | undefined): TransportMode {
  if (value === "http") return "http";
  return "stdio";
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

export function loadConfig(args: string[] = process.argv): ServerConfig {
  // CLI args override env vars for transport
  const transportArg = args.find((a) => a.startsWith("--transport="));
  const transportValue = transportArg
    ? transportArg.split("=")[1]
    : process.env.ZENTROPY_TRANSPORT;

  return {
    transport: parseTransport(transportValue),
    port: parseInt(process.env.ZENTROPY_MCP_PORT || "3100", 10),
    backendUrl:
      process.env.ZENTROPY_BACKEND_URL || "http://localhost:3002",
    accessToken: process.env.ZENTROPY_ACCESS_TOKEN,
    oauth: {
      issuer:
        process.env.ZENTROPY_OAUTH_ISSUER || "https://auth.zentropy.app",
      clientId: process.env.ZENTROPY_OAUTH_CLIENT_ID || "",
      audience:
        process.env.ZENTROPY_OAUTH_AUDIENCE || "https://mcp.zentropy.app",
    },
    logLevel: parseLogLevel(process.env.ZENTROPY_LOG_LEVEL),
    rateLimits: {
      globalPerMinute: 1000,
      perUserPerMinute: 100,
      perUserWritePerMinute: 20,
      perUserQueryPerMinute: 30,
    },
  };
}
