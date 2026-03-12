import { describe, expect, it } from "vitest";

import { extractMcpAccessToken } from "@/mcp/security/http-token";

describe("extractMcpAccessToken", () => {
  it("prefers Authorization bearer token", () => {
    const token = extractMcpAccessToken({
      headers: {
        authorization: "Bearer auth-token",
        "x-zentropy-access-token": "header-token",
      },
      url: "/mcp?access_token=query-token",
    });

    expect(token).toBe("auth-token");
  });

  it("uses explicit token header when Authorization is absent", () => {
    const token = extractMcpAccessToken({
      headers: {
        "x-zentropy-access-token": "header-token",
      },
      url: "/mcp?access_token=query-token",
    });

    expect(token).toBe("header-token");
  });

  it("falls back to access_token query parameter for Codex-compatible urls", () => {
    const token = extractMcpAccessToken({
      headers: {},
      url: "/mcp?access_token=query-token",
    });

    expect(token).toBe("query-token");
  });

  it("returns undefined when no token source is present", () => {
    const token = extractMcpAccessToken({
      headers: {},
      url: "/mcp",
    });

    expect(token).toBeUndefined();
  });
});
