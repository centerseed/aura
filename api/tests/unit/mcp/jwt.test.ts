/**
 * Unit tests for MCP JWT token utility.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Set env before importing the module
const TEST_SECRET = "a-very-secure-secret-that-is-at-least-32-characters-long";

describe("MCP JWT Utility", () => {
  beforeEach(() => {
    vi.stubEnv("ZENTROPY_MCP_JWT_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("issueAccessToken + verifyAccessToken", () => {
    it("should issue and verify a valid token", async () => {
      const { issueAccessToken, verifyAccessToken } = await import(
        "@/mcp/oauth/jwt"
      );

      const result = issueAccessToken({
        userId: "user-123",
        clientId: "client-abc",
        scope: "read:tasks write:inbox",
      });

      expect(result.token).toBeDefined();
      expect(result.expiresIn).toBe(259200); // 3 days
      expect(result.expiresAt).toBeInstanceOf(Date);

      const payload = verifyAccessToken(result.token);
      expect(payload.sub).toBe("user-123");
      expect(payload.azp).toBe("client-abc");
      expect(payload.scope).toBe("read:tasks write:inbox");
      expect(payload.iss).toBe("zentropy-mcp");
    });

    it("should support custom token TTLs for personal access tokens", async () => {
      const { issueAccessToken, verifyAccessToken } = await import(
        "@/mcp/oauth/jwt"
      );

      const result = issueAccessToken({
        userId: "user-123",
        clientId: "codex",
        scope: "read:tasks",
        issuer: "zentropy-mcp-personal-token",
        expiresInSeconds: 90 * 24 * 3600,
      });

      expect(result.expiresIn).toBe(90 * 24 * 3600);
      const payload = verifyAccessToken(result.token);
      expect(payload.iss).toBe("zentropy-mcp-personal-token");
    });

    it("should reject a tampered token", async () => {
      const { issueAccessToken, verifyAccessToken } = await import(
        "@/mcp/oauth/jwt"
      );

      const result = issueAccessToken({
        userId: "user-123",
        clientId: "client-abc",
        scope: "read:tasks",
      });

      // Tamper with the signature
      const parts = result.token.split(".");
      parts[2] = parts[2].slice(0, -2) + "XX";
      const tamperedToken = parts.join(".");

      expect(() => verifyAccessToken(tamperedToken)).toThrow(
        "Invalid token signature",
      );
    });

    it("should reject a malformed token (wrong number of parts)", async () => {
      const { verifyAccessToken } = await import("@/mcp/oauth/jwt");

      expect(() => verifyAccessToken("only.two")).toThrow(
        "Invalid token format",
      );
      expect(() => verifyAccessToken("just-a-string")).toThrow(
        "Invalid token format",
      );
    });

    it("should reject an expired token", async () => {
      const { verifyAccessToken } = await import("@/mcp/oauth/jwt");
      const { createHmac } = await import("node:crypto");

      // Manually build an expired token
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: "user-123",
          azp: "client-abc",
          scope: "read:tasks",
          iat: Math.floor(Date.now() / 1000) - 7200,
          exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
          iss: "zentropy-mcp",
        }),
      ).toString("base64url");
      const data = `${header}.${payload}`;
      const sig = createHmac("sha256", TEST_SECRET)
        .update(data)
        .digest("base64url");

      expect(() => verifyAccessToken(`${data}.${sig}`)).toThrow(
        "Token expired",
      );
    });

    it("should reject a token with truncated/malformed payload", async () => {
      const { verifyAccessToken } = await import("@/mcp/oauth/jwt");
      const { createHmac } = await import("node:crypto");

      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from("{truncated").toString("base64url");
      const data = `${header}.${payload}`;
      const sig = createHmac("sha256", TEST_SECRET)
        .update(data)
        .digest("base64url");

      expect(() => verifyAccessToken(`${data}.${sig}`)).toThrow(
        "Malformed token payload",
      );
    });
  });

  describe("generateRefreshToken + hashRefreshToken", () => {
    it("should generate a refresh token and its matching hash", async () => {
      const { generateRefreshToken, hashRefreshToken } = await import(
        "@/mcp/oauth/jwt"
      );

      const result = generateRefreshToken();
      expect(result.raw).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Hash should match when computed from raw
      const reHash = hashRefreshToken(result.raw);
      expect(reHash).toBe(result.hash);
    });

    it("should produce different tokens each time", async () => {
      const { generateRefreshToken } = await import("@/mcp/oauth/jwt");

      const a = generateRefreshToken();
      const b = generateRefreshToken();
      expect(a.raw).not.toBe(b.raw);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe("verifyPkce", () => {
    it("should verify a valid S256 PKCE challenge", async () => {
      const { verifyPkce } = await import("@/mcp/oauth/jwt");
      const { createHash } = await import("node:crypto");

      const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      expect(verifyPkce(codeVerifier, codeChallenge)).toBe(true);
    });

    it("should reject an invalid PKCE verifier", async () => {
      const { verifyPkce } = await import("@/mcp/oauth/jwt");
      const { createHash } = await import("node:crypto");

      const codeVerifier = "correct-verifier";
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      expect(verifyPkce("wrong-verifier", codeChallenge)).toBe(false);
    });
  });

  describe("signInternalAuth + verifyInternalAuth", () => {
    it("should sign and verify internal auth", async () => {
      const { signInternalAuth, verifyInternalAuth } = await import(
        "@/mcp/oauth/jwt"
      );

      const hmac = signInternalAuth("user-123");
      expect(hmac).toBeDefined();
      expect(verifyInternalAuth("user-123", hmac)).toBe(true);
    });

    it("should reject wrong userId", async () => {
      const { signInternalAuth, verifyInternalAuth } = await import(
        "@/mcp/oauth/jwt"
      );

      const hmac = signInternalAuth("user-123");
      expect(verifyInternalAuth("user-456", hmac)).toBe(false);
    });

    it("should reject tampered HMAC", async () => {
      const { signInternalAuth, verifyInternalAuth } = await import(
        "@/mcp/oauth/jwt"
      );

      const hmac = signInternalAuth("user-123");
      const tampered = hmac.slice(0, -2) + "ff";
      expect(verifyInternalAuth("user-123", tampered)).toBe(false);
    });
  });

  describe("getSecret()", () => {
    it("should throw when secret is not set", async () => {
      vi.stubEnv("ZENTROPY_MCP_JWT_SECRET", "");

      const { issueAccessToken } = await import("@/mcp/oauth/jwt");

      expect(() =>
        issueAccessToken({
          userId: "u",
          clientId: "c",
          scope: "s",
        }),
      ).toThrow("ZENTROPY_MCP_JWT_SECRET must be set");
    });

    it("should throw when secret is too short", async () => {
      vi.stubEnv("ZENTROPY_MCP_JWT_SECRET", "short");

      const { issueAccessToken } = await import("@/mcp/oauth/jwt");

      expect(() =>
        issueAccessToken({
          userId: "u",
          clientId: "c",
          scope: "s",
        }),
      ).toThrow("ZENTROPY_MCP_JWT_SECRET must be set");
    });
  });
});
