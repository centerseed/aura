/**
 * MCP JWT Token Utility
 *
 * Signs and verifies stateless access tokens for MCP clients.
 * Uses HMAC-SHA256 (HS256) with a server secret.
 *
 * Access tokens are long-lived (3 days) with sliding window extension stored in DB.
 * Refresh tokens are long-lived (30 days) and stored in DB for revocation.
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALG = "HS256";
const ACCESS_TOKEN_TTL = 3 * 24 * 3600; // 3 days = 259200 seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 3600; // 30 days

export interface McpTokenPayload {
  /** Subject — Zentropy user ID (DB UUID) */
  sub: string;
  /** Client ID — the MCP client that requested the token */
  azp: string;
  /** Scopes granted */
  scope: string;
  /** Issued at (unix timestamp) */
  iat: number;
  /** Expires at (unix timestamp) */
  exp: number;
  /** Issuer */
  iss: string;
}

function getSecret(): string {
  const secret = process.env.ZENTROPY_MCP_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ZENTROPY_MCP_JWT_SECRET must be set (min 32 chars). " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  return secret;
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

/**
 * Timing-safe string comparison.
 * Both strings are hashed first to ensure equal length for timingSafeEqual.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string, secret: string): string {
  const header = base64url(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const body = base64url(payload);
  const data = `${header}.${body}`;
  const signature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Issue a signed MCP access token (JWT).
 */
export function issueAccessToken(params: {
  userId: string;
  clientId: string;
  scope: string;
  issuer?: string;
}): { token: string; expiresIn: number; expiresAt: Date } {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  const payload: McpTokenPayload = {
    sub: params.userId,
    azp: params.clientId,
    scope: params.scope,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL,
    iss: params.issuer || "zentropy-mcp",
  };

  const token = sign(JSON.stringify(payload), secret);
  return {
    token,
    expiresIn: ACCESS_TOKEN_TTL,
    expiresAt: new Date((now + ACCESS_TOKEN_TTL) * 1000),
  };
}

/**
 * Generate a random refresh token string.
 * The raw token is returned to the client; the hash is stored in DB.
 */
export function generateRefreshToken(): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = randomBytes(48).toString("base64url");
  const secret = getSecret();
  const hash = createHmac("sha256", secret)
    .update(raw)
    .digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

  return { raw, hash, expiresAt };
}

/**
 * Hash a refresh token for DB lookup.
 */
export function hashRefreshToken(raw: string): string {
  const secret = getSecret();
  return createHmac("sha256", secret).update(raw).digest("hex");
}

/**
 * Hash an access token for DB storage/lookup (tracking and revocation).
 */
export function hashAccessToken(token: string): string {
  const secret = getSecret();
  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Verify and decode an MCP access token.
 * @throws Error if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): McpTokenPayload {
  const secret = getSecret();
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [header, body, signature] = parts;
  const data = `${header}.${body}`;

  // Verify signature (timing-safe)
  const expectedSig = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  if (!safeEqual(signature, expectedSig)) {
    throw new Error("Invalid token signature");
  }

  // Decode payload (with crash protection for truncated/malformed tokens)
  let payload: McpTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8"),
    );
  } catch {
    throw new Error("Malformed token payload");
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
}

/**
 * Generate a random authorization code.
 */
export function generateAuthCode(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Verify PKCE code_verifier against code_challenge (S256 method).
 * S256: BASE64URL(SHA256(code_verifier)) === code_challenge
 * Uses timing-safe comparison.
 */
export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
): boolean {
  const computed = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return safeEqual(computed, codeChallenge);
}

/**
 * Generate an HMAC for internal service authentication.
 * Used by BackendApiClient for same-process API calls.
 */
export function signInternalAuth(userId: string): string {
  const secret = getSecret();
  return createHmac("sha256", secret)
    .update(`internal:${userId}`)
    .digest("hex");
}

/**
 * Verify an internal service auth HMAC.
 */
export function verifyInternalAuth(userId: string, hmac: string): boolean {
  const secret = getSecret();
  const expected = createHmac("sha256", secret)
    .update(`internal:${userId}`)
    .digest("hex");
  return safeEqual(hmac, expected);
}
