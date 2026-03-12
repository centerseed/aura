import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyIdToken = vi.fn();
const getOrCreateUser = vi.fn();
const createAccessTokenRecord = vi.fn();
const issueAccessToken = vi.fn();
const hashAccessToken = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken,
  })),
}));

vi.mock("@/lib/auth-middleware", () => ({
  getOrCreateUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mcpAccessToken: {
      create: createAccessTokenRecord,
    },
  },
}));

vi.mock("@/mcp/oauth/jwt", () => ({
  PERSONAL_ACCESS_TOKEN_TTL: 90 * 24 * 60 * 60,
  issueAccessToken,
  hashAccessToken,
}));

describe("POST /api/mcp/personal-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mints a personal token without affecting OAuth flow", async () => {
    verifyIdToken.mockResolvedValue({ uid: "firebase-user-1" });
    getOrCreateUser.mockResolvedValue("user-1");
    issueAccessToken.mockReturnValue({
      token: "minted-token",
      expiresIn: 90 * 24 * 60 * 60,
      expiresAt: new Date("2026-06-10T00:00:00.000Z"),
    });
    hashAccessToken.mockReturnValue("token-hash");
    createAccessTokenRecord.mockResolvedValue({});

    const { POST } = await import("@/app/api/mcp/personal-token/route");
    const request = new NextRequest("https://api.zentropy.cc/api/mcp/personal-token", {
      method: "POST",
      headers: {
        authorization: "Bearer firebase-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_name: "codex",
        expires_in_days: 120,
        scopes: ["read:tasks", "write:inbox", "unknown:scope"],
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith("firebase-token");
    expect(issueAccessToken).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "codex",
      scope: "read:tasks write:inbox",
      issuer: "zentropy-mcp-personal-token",
      expiresInSeconds: 90 * 24 * 60 * 60,
    });
    expect(createAccessTokenRecord).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token_hash: "token-hash",
        user_id: "user-1",
        client_id: "codex",
        scope: "read:tasks write:inbox",
      }),
    });
    expect(json.data.access_token).toBe("minted-token");
    expect(json.data.mcp_url).toContain("/mcp?access_token=minted-token");
  });

  it("rejects requests without Firebase auth", async () => {
    const { POST } = await import("@/app/api/mcp/personal-token/route");
    const request = new NextRequest("https://api.zentropy.cc/api/mcp/personal-token", {
      method: "POST",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Missing or invalid authorization header");
    expect(issueAccessToken).not.toHaveBeenCalled();
  });
});
