import { beforeEach, describe, expect, it, vi } from "vitest"
import { GetAgentChatTurnsUseCase } from "@/application/use-cases/agent/get-chat-turns"
import { prisma } from "@/lib/db"
import { ValidationException } from "@/lib/api-response"

vi.mock("@/lib/db", () => ({
  prisma: {
    agentChatTurn: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe("GetAgentChatTurnsUseCase", () => {
  let useCase: GetAgentChatTurnsUseCase

  beforeEach(() => {
    useCase = new GetAgentChatTurnsUseCase()
    vi.mocked(prisma.agentChatTurn.count).mockReset()
    vi.mocked(prisma.agentChatTurn.findMany).mockReset()
  })

  it("returns filtered chat turns with normalized intent_object", async () => {
    vi.mocked(prisma.agentChatTurn.count).mockResolvedValue(1)
    vi.mocked(prisma.agentChatTurn.findMany).mockResolvedValue([
      {
        id: "turn-1",
        user_id: "user-1",
        channel: "LINE",
        session_id: "line-user-1",
        request_text: "今天要做什麼",
        response_text: "你今天有三件事",
        tool_calls: ["query_today_tasks"],
        intent: { object: "today_focus", confidence: 0.99, requiresConfirmation: false },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        timings: { total_ms: 500 },
        trace: { selectedTool: "query_today_tasks" },
        metadata: { verified: true },
        status: "SUCCESS",
        error_message: null,
        created_at: new Date("2026-03-12T00:00:00.000Z"),
        updated_at: new Date("2026-03-12T00:00:01.000Z"),
      },
    ] as any)

    const result = await useCase.execute({
      userId: "user-1",
      channel: "LINE",
      status: "SUCCESS",
      sessionId: "line-user-1",
      from: "2026-03-11T00:00:00.000Z",
      to: "2026-03-12T23:59:59.999Z",
      limit: 10,
      offset: 0,
    })

    expect(prisma.agentChatTurn.count).toHaveBeenCalledWith({
      where: {
        user_id: "user-1",
        channel: "LINE",
        status: "SUCCESS",
        session_id: "line-user-1",
        created_at: {
          gte: new Date("2026-03-11T00:00:00.000Z"),
          lte: new Date("2026-03-12T23:59:59.999Z"),
        },
      },
    })

    expect(result).toEqual({
      total: 1,
      limit: 10,
      offset: 0,
      items: [
        expect.objectContaining({
          id: "turn-1",
          channel: "LINE",
          session_id: "line-user-1",
          tool_calls: ["query_today_tasks"],
          intent_object: "today_focus",
          status: "SUCCESS",
        }),
      ],
    })
  })

  it("throws on invalid date filter", async () => {
    await expect(useCase.execute({
      userId: "user-1",
      from: "not-a-date",
    })).rejects.toThrow(ValidationException)
  })
})
