/**
 * MCP Authentication Middleware (Section 2.2)
 *
 * Validates MCP access tokens (JWTs signed by our OAuth token endpoint).
 * Falls back to dev context when ZENTROPY_MCP_JWT_SECRET is not set.
 */

import type { AuthContext, OAuthScope } from "../types";
import { verifyAccessToken, type McpTokenPayload } from "../oauth/jwt";

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Authenticate an MCP request from the Authorization header.
 *
 * Production: Verifies the JWT signature and extracts user context.
 * Development: Falls back to dev context if JWT secret is not configured.
 */
export function authenticateMcpRequest(authHeader?: string): AuthContext {
  // If no JWT secret configured...
  if (!process.env.ZENTROPY_MCP_JWT_SECRET) {
    // In production, refuse to start without a secret — silent dev bypass is dangerous
    if (process.env.NODE_ENV === "production") {
      throw new AuthenticationError(
        "ZENTROPY_MCP_JWT_SECRET is not configured. " +
          "MCP authentication is disabled in production without a secret.",
      );
    }
    // Dev only: use dev context
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return decodeTokenUnsafe(authHeader.slice("Bearer ".length));
    }
    return createDevContext();
  }

  // Production: require and verify Bearer token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError(
      "Missing or invalid Authorization header. Expected: Bearer <token>",
    );
  }

  const token = authHeader.slice("Bearer ".length);
  if (!token) {
    throw new AuthenticationError("Empty access token.");
  }

  try {
    const payload = verifyAccessToken(token);
    return payloadToAuthContext(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token";
    throw new AuthenticationError(message);
  }
}

function payloadToAuthContext(payload: McpTokenPayload): AuthContext {
  const scopes = parseScopes(payload.scope);
  return {
    userId: payload.sub,
    clientId: payload.azp,
    scopes: scopes.length > 0 ? scopes : getAllScopes(),
    tokenExpiry: payload.exp,
  };
}

/**
 * Decode token without signature verification (dev mode only).
 */
function decodeTokenUnsafe(token: string): AuthContext {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return createDevContext();
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );

    return {
      userId: payload.sub || payload.user_id || "dev-user",
      clientId: payload.azp || payload.client_id || "dev-client",
      scopes: parseScopes(payload.scope || payload.scp || "") || getAllScopes(),
      tokenExpiry: payload.exp || Math.floor(Date.now() / 1000) + 3600,
    };
  } catch {
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
