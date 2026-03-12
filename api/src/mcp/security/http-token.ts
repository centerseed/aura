import { parse } from "node:url";
import type { IncomingHttpHeaders } from "node:http";

export interface McpHttpRequestLike {
  headers: IncomingHttpHeaders;
  url?: string;
}

/**
 * Extract the MCP access token from a remote HTTP request.
 *
 * Priority:
 * 1. Authorization: Bearer <token>
 * 2. x-zentropy-access-token header
 * 3. ?access_token=... query param (Codex compatibility fallback)
 */
export function extractMcpAccessToken(
  request: McpHttpRequestLike,
): string | undefined {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  const explicitHeader = request.headers["x-zentropy-access-token"];
  if (typeof explicitHeader === "string" && explicitHeader.trim()) {
    return explicitHeader.trim();
  }

  const queryToken = parse(request.url || "/", true).query.access_token;
  if (typeof queryToken === "string" && queryToken.trim()) {
    return queryToken.trim();
  }

  return undefined;
}
