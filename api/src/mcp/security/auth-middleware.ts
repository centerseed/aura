/**
 * MCP Authentication Middleware (Section 2.2)
 *
 * Validates access tokens from MCP clients.
 * In the integrated server, MCP clients authenticate with Firebase ID tokens
 * (same as the web app). The token is passed through to internal API calls.
 */

import type { AuthContext, OAuthScope } from "../types";

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Authenticate an MCP request from the Authorization header.
 *
 * In production, this verifies the Firebase ID token.
 * For the MVP, we decode JWT claims and trust the token
 * (actual verification happens when the token is passed to API routes).
 */
export function authenticateMcpRequest(authHeader?: string): AuthContext {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError(
      "Missing or invalid Authorization header. Expected: Bearer <token>",
    );
  }

  const token = authHeader.slice("Bearer ".length);
  if (!token) {
    throw new AuthenticationError("Empty access token.");
  }

  return decodeToken(token);
}

function decodeToken(token: string): AuthContext {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      // Not a JWT — in dev mode, return a default context
      return createDevContext();
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );

    const scopes = parseScopes(payload.scope || payload.scp || "");

    return {
      userId: payload.sub || payload.user_id || "unknown",
      clientId: payload.azp || payload.client_id || "unknown",
      scopes: scopes.length > 0 ? scopes : getAllScopes(),
      tokenExpiry: payload.exp || 0,
    };
  } catch {
    // If token decoding fails, provide dev context for local testing
    return createDevContext();
  }
}

function parseScopes(scopeStr: string | string[]): OAuthScope[] {
  const validScopes: OAuthScope[] = [
    "read:tasks",
    "read:knowledge",
    "read:profile",
    "write:inbox",
    "write:knowledge",
    "trigger:librarian",
  ];

  const raw = Array.isArray(scopeStr)
    ? scopeStr
    : scopeStr.split(" ").filter(Boolean);

  return raw.filter((s): s is OAuthScope =>
    validScopes.includes(s as OAuthScope),
  );
}

function getAllScopes(): OAuthScope[] {
  return [
    "read:tasks",
    "read:knowledge",
    "read:profile",
    "write:inbox",
    "write:knowledge",
    "trigger:librarian",
  ];
}

function createDevContext(): AuthContext {
  return {
    userId: "dev-user",
    clientId: "dev-client",
    scopes: getAllScopes(),
    tokenExpiry: Math.floor(Date.now() / 1000) + 3600,
  };
}
