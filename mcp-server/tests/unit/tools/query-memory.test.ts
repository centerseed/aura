import { describe, it, expect, vi } from "vitest";
import { handleQueryMemory } from "../../../src/tools/query-memory.js";
import type { BackendApiClient } from "../../../src/backend-client/api-client.js";
import type { AuthContext } from "../../../src/types.js";

function mockApiClient(): BackendApiClient {
  return {
    captureThought: vi.fn(),
    appendToKnowledge: vi.fn(),
    queryMemory: vi.fn().mockResolvedValue({
      results: [
        {
          id: "doc-1",
          title: "Auth Decision",
          content: "We chose JWT",
          score: 0.95,
          product_name: "Naruvia",
        },
      ],
      total: 1,
    }),
    getKnowledgeAsset: vi.fn(),
    getRollingSaga: vi.fn(),
    getUserPreferences: vi.fn(),
  } as unknown as BackendApiClient;
}

function mockAuth(): AuthContext {
  return {
    userId: "user-1",
    clientId: "client-1",
    scopes: ["read:tasks"],
    tokenExpiry: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe("query_memory tool handler", () => {
  it("should call backend API and return results", async () => {
    const api = mockApiClient();
    const result = await handleQueryMemory(
      api,
      mockAuth(),
      { query: "What auth method?" },
      false,
      "token-123",
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe("Auth Decision");
    expect(result.total).toBe(1);
    expect(result._warning).toBeUndefined();
  });

  it("should pass scope parameter to backend", async () => {
    const api = mockApiClient();
    await handleQueryMemory(
      api,
      mockAuth(),
      { query: "test", scope: "Naruvia" },
      false,
      "token-123",
    );

    expect(api.queryMemory).toHaveBeenCalledWith("token-123", {
      query: "test",
      scope: "Naruvia",
    });
  });

  it("should include warning when content was sanitized", async () => {
    const api = mockApiClient();
    const result = await handleQueryMemory(
      api,
      mockAuth(),
      { query: "sanitized query" },
      true,
      "token-123",
    );

    expect(result._warning).toBe("content_sanitized");
  });
});
