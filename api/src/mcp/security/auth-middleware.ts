/**
 * MCP Authentication Middleware (Section 2.2)
 *
 * Validates MCP access tokens (JWTs signed by our OAuth token endpoint).
 * Falls back to dev context when ZENTROPY_MCP_JWT_SECRET is not set.
 */

import type { AuthContext, OAuthScope } from "../types";
import { verifyAccessToken, hashAccessToken, type McpTokenPayload } from "../oauth/jwt";
import { prisma } from "@/lib/db";

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
export async function authenticateMcpRequest(authHeader?: string): Promise<AuthContext> {
  const token = extractRawToken(authHeader);

  // If no JWT secret configured...
  if (!process.env.ZENTROPY_MCP_JWT_SECRET) {
    // In production, refuse to start without a secret — silent dev bypass is dangerous
    if (process.env.NODE_ENV === "production") {
      throw new AuthenticationError(
        "ZENTROPY_MCP_JWT_SECRET is not configured. " +
          "MCP authentication is disabled in production without a secret.",
      );
    }
    // Dev only: decode token without verification, then resolve Firebase UID → DB UUID
    if (token) {
      const ctx = decodeTokenUnsafe(token);
      ctx.userId = await resolveUserId(ctx.userId);
      return ctx;
    }
    return createDevContext();
  }

  // Production: require and verify Bearer token
  if (!token) {
    throw new AuthenticationError(
      "Missing MCP access token.",
    );
  }

  try {
    const payload = verifyAccessToken(token);
    // Fire-and-forget: update last_used in DB (does not block the request)
    updateAccessTokenLastUsed(token, payload).catch(() => {});
    return payloadToAuthContext(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token";
    throw new AuthenticationError(message);
  }
}

function extractRawToken(authValue?: string): string | undefined {
  if (!authValue) return undefined;
  if (authValue.startsWith("Bearer ")) {
    const token = authValue.slice("Bearer ".length).trim();
    return token || undefined;
  }
  const token = authValue.trim();
  return token || undefined;
}

const ACCESS_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Fire-and-forget: update last_used timestamp in mcp_access_tokens.
 * Runs asynchronously and errors are silently ignored.
 */
async function updateAccessTokenLastUsed(token: string, payload: McpTokenPayload): Promise<void> {
  const tokenHash = hashAccessToken(token);
  const now = new Date();
  // Extend expires_at in DB if token has less than 24h remaining (sliding window)
  const remainingMs = payload.exp * 1000 - Date.now();
  const shouldExtend = remainingMs < 24 * 60 * 60 * 1000;

  await prisma.mcpAccessToken.updateMany({
    where: { token_hash: tokenHash, revoked_at: null },
    data: {
      last_used: now,
      ...(shouldExtend ? { expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_MS) } : {}),
    },
  });
}

/**
 * Resolve a Firebase UID to a DB UUID.
 * If the userId is already a UUID (contains hyphens), return as-is.
 * Otherwise look up by auth_provider_id and auto-create if not found.
 */
async function resolveUserId(userId: string): Promise<string> {
  if (userId.includes("-")) return userId; // already a UUID
  const user = await prisma.user.findFirst({ where: { auth_provider_id: userId } });
  if (user) return user.id;
  // Auto-create the user so dev bypass works end-to-end
  const created = await prisma.user.create({
    data: { auth_provider: "GOOGLE", auth_provider_id: userId },
  });
  return created.id;
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
