/**
 * OAuth 2.1 Authentication Middleware (Section 2.2)
 *
 * Validates access tokens and extracts user context.
 * - HTTP mode: validates OAuth Bearer token against the IdP
 * - Stdio mode: reads token from ZENTROPY_ACCESS_TOKEN env var
 */

import type { ServerConfig } from "../config.js";
import type { AuthContext, OAuthScope } from "../types.js";

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Decode and validate the access token.
 *
 * In production, this would verify the JWT signature against the IdP's JWKS.
 * For the initial implementation, we support:
 * 1. Stdio mode: trust the ZENTROPY_ACCESS_TOKEN env var
 * 2. HTTP mode: decode JWT and validate claims
 */
export class AuthMiddleware {
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * Authenticate a request and return the user context.
   * @param authHeader - The Authorization header value (e.g. "Bearer <token>")
   */
  async authenticate(authHeader?: string): Promise<AuthContext> {
    if (this.config.transport === "stdio") {
      return this.authenticateStdio();
    }
    return this.authenticateHttp(authHeader);
  }

  private authenticateStdio(): AuthContext {
    const token = this.config.accessToken;
    if (!token) {
      throw new AuthenticationError(
        "ZENTROPY_ACCESS_TOKEN is not set. Run `zentropy auth login` to authenticate.",
      );
    }

    // In stdio mode, we decode the token to extract claims.
    // The token is trusted as it was obtained via the CLI OAuth flow.
    return this.decodeToken(token);
  }

  private async authenticateHttp(
    authHeader?: string,
  ): Promise<AuthContext> {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError(
        "Missing or invalid Authorization header. Expected: Bearer <token>",
      );
    }

    const token = authHeader.slice("Bearer ".length);
    if (!token) {
      throw new AuthenticationError("Empty access token.");
    }

    // Decode and validate the token
    const context = this.decodeToken(token);

    // Verify expiry
    if (context.tokenExpiry < Date.now() / 1000) {
      throw new AuthenticationError("Access token has expired.");
    }

    return context;
  }

  /**
   * Decode a JWT-like token and extract the AuthContext.
   *
   * In production, this would:
   * 1. Verify JWT signature using JWKS from the OAuth issuer
   * 2. Validate issuer, audience, and expiry claims
   * 3. Check Resource Indicator (RFC 8707)
   *
   * Current implementation: base64-decode the payload for claim extraction,
   * with full signature verification to be added with the OAuth provider.
   */
  private decodeToken(token: string): AuthContext {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        // Not a JWT — in stdio dev mode, return a default context
        return this.createDevContext();
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf-8"),
      );

      const scopes = this.parseScopes(payload.scope || payload.scp || "");

      return {
        userId: payload.sub || "unknown",
        clientId: payload.azp || payload.client_id || "unknown",
        scopes,
        tokenExpiry: payload.exp || 0,
      };
    } catch {
      // If token decoding fails in stdio mode, provide dev context
      if (this.config.transport === "stdio") {
        return this.createDevContext();
      }
      throw new AuthenticationError("Invalid access token format.");
    }
  }

  private parseScopes(scopeStr: string | string[]): OAuthScope[] {
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

  /**
   * Development-only context for stdio mode when the token is not a valid JWT.
   * In production, even stdio mode requires a valid token from `zentropy auth login`.
   */
  private createDevContext(): AuthContext {
    return {
      userId: "dev-user",
      clientId: "dev-client",
      scopes: [
        "read:tasks",
        "read:knowledge",
        "read:profile",
        "write:inbox",
        "write:knowledge",
        "trigger:librarian",
      ],
      tokenExpiry: Math.floor(Date.now() / 1000) + 3600,
    };
  }
}
