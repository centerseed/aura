import { describe, it, expect, vi } from "vitest";
import { handleCaptureThought } from "../../../src/tools/capture-thought.js";
import type { BackendApiClient } from "../../../src/backend-client/api-client.js";
import type { AuthContext } from "../../../src/types.js";

function mockApiClient(): BackendApiClient {
  return {
    captureThought: vi.fn().mockResolvedValue({
      id: "task-123",
      status: "created",
    }),
    appendToKnowledge: vi.fn(),
    queryMemory: vi.fn(),
    getKnowledgeAsset: vi.fn(),
    getRollingSaga: vi.fn(),
    getUserPreferences: vi.fn(),
  } as unknown as BackendApiClient;
}

function mockAuth(): AuthContext {
  return {
    userId: "user-1",
    clientId: "client-1",
    scopes: ["write:inbox"],
    tokenExpiry: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe("capture_thought tool handler", () => {
  it("should call backend API and return result", async () => {
    const api = mockApiClient();
    const result = await handleCaptureThought(
      api,
      mockAuth(),
      {
        content: "Test thought",
        source: "Claude Code",
      },
      false,
      "token-123",
    );

    expect(result.id).toBe("task-123");
    expect(result.status).toBe("created");
    expect(result._warning).toBeUndefined();
    expect(api.captureThought).toHaveBeenCalledWith("token-123", {
      content: "Test thought",
      source: "Claude Code",
      context_hint: undefined,
    });
  });

  it("should include warning when content was sanitized", async () => {
    const api = mockApiClient();
    const result = await handleCaptureThought(
      api,
      mockAuth(),
      {
        content: "Sanitized content",
        source: "Cursor",
      },
      true,
      "token-123",
    );

    expect(result._warning).toBe("content_sanitized");
  });

  it("should pass context_hint to backend", async () => {
    const api = mockApiClient();
    await handleCaptureThought(
      api,
      mockAuth(),
      {
        content: "test",
        source: "API",
        context_hint: "related to auth",
      },
      false,
      "token-123",
    );

    expect(api.captureThought).toHaveBeenCalledWith(
      "token-123",
      expect.objectContaining({
        context_hint: "related to auth",
      }),
    );
  });
});
