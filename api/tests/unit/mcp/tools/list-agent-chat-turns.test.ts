import { describe, expect, it, vi } from "vitest"
import type { BackendApiClient } from "@/mcp/backend-client/api-client"
import type { AuthContext } from "@/mcp/types"
import { handleListAgentChatTurns } from "@/mcp/tools/list-agent-chat-turns"

function mockApiClient(overrides: Partial<BackendApiClient> = {}): BackendApiClient {
  return {
    getAgentChatTurns: vi.fn(),
    ...overrides,
  } as unknown as BackendApiClient
}

const authContext: AuthContext = {
  userId: "user-123",
  clientId: "test-client",
  scopes: ["read:tasks"],
  tokenExpiry: Date.now() + 3600_000,
}

describe("handleListAgentChatTurns", () => {
  it("returns stable slim shape for agent analysis", async () => {
    const getAgentChatTurns = vi.fn().mockResolvedValue({
      total: 1,
      limit: 20,
      offset: 0,
      items: [
        {
          id: "turn-1",
          channel: "API",
          session_id: "api:user-123",
          request_text: "幫我看今天要做什麼",
          response_text: "你今天有 2 件事",
          tool_calls: ["query_today_tasks"],
          status: "SUCCESS",
          error_message: null,
          intent_object: "today_focus",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          timings: { total_ms: 321 },
          created_at: "2026-03-12T00:00:00.000Z",
        },
      ],
    })
    const api = mockApiClient({ getAgentChatTurns })

    const result = await handleListAgentChatTurns(api, authContext, { channel: "API", limit: 20 }, true)

    expect(getAgentChatTurns).toHaveBeenCalledWith("user-123", {
      channel: "API",
      status: undefined,
      session_id: undefined,
      from: undefined,
      to: undefined,
      limit: 20,
      offset: undefined,
    })

    expect(result).toEqual({
      total: 1,
      limit: 20,
      offset: 0,
      items: [
        {
          id: "turn-1",
          channel: "API",
          session_id: "api:user-123",
          request_text: "幫我看今天要做什麼",
          response_text: "你今天有 2 件事",
          tool_calls: ["query_today_tasks"],
          status: "SUCCESS",
          error_message: null,
          intent_object: "today_focus",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          timings: { total_ms: 321 },
          created_at: "2026-03-12T00:00:00.000Z",
        },
      ],
    })
  })
})
