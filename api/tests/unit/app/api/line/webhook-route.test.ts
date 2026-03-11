import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mockPushMessage = vi.fn()
const mockLineClient = {
  pushMessage: mockPushMessage,
}
const mockVerifyLineSignature = vi.fn()
const mockUserFindFirst = vi.fn()
const pendingLineSessions = new Map<string, { type: string; payload: unknown }>()
const mockGetLineSession = vi.fn()
const mockClearLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockCompleteTaskExecute = vi.fn()
const mockUpdateSubItemExecute = vi.fn()
const mockUpdatePlanItemExecute = vi.fn()
const mockAgentChat = vi.fn()
const mockQueryTodayExecute = vi.fn()
const mockQueryCompletedTodayExecute = vi.fn()
const mockCreateCompleteTaskSearchTool = vi.fn()
const mockCreateZentropyAgent = vi.fn(() => ({
  chat: mockAgentChat,
}))

async function flushAsyncWork(rounds = 5): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve()
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
}

vi.mock("@/lib/line-client", () => ({
  verifyLineSignature: mockVerifyLineSignature,
  getLineClient: vi.fn(() => mockLineClient),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: mockUserFindFirst,
    },
  },
}))

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  clearLineSession: mockClearLineSession,
  saveLineSession: mockSaveLineSession,
}))

vi.mock("@/application/use-cases/tasks/complete-task", () => ({
  CompleteTaskUseCase: vi.fn().mockImplementation(() => ({
    execute: mockCompleteTaskExecute,
  })),
}))

vi.mock("@/application/use-cases/tasks/update-sub-item", () => ({
  UpdateSubItemUseCase: vi.fn().mockImplementation(() => ({
    execute: mockUpdateSubItemExecute,
  })),
}))

vi.mock("@/application/use-cases/coach/update-plan-item", () => ({
  UpdatePlanItemUseCase: vi.fn().mockImplementation(() => ({
    execute: mockUpdatePlanItemExecute,
  })),
}))

vi.mock("@/application/use-cases/agent/zentropy-agent", () => ({
  createZentropyAgent: mockCreateZentropyAgent,
}))

vi.mock("@/application/use-cases/agent/query-tasks-skill", () => ({
  createQueryTodayTasksTool: vi.fn(() => ({
    execute: mockQueryTodayExecute,
  })),
  createQueryCompletedTodayTasksTool: vi.fn(() => ({
    execute: mockQueryCompletedTodayExecute,
  })),
}))

vi.mock("@/application/use-cases/agent/complete-task-skill", () => ({
  createCompleteTaskSearchTool: mockCreateCompleteTaskSearchTool,
  createParameterizedCompleteTaskSearchTool: mockCreateCompleteTaskSearchTool,
}))

const { ToolFirstAgent } = await import("@/application/use-cases/agent/tool-first-agent")
const { POST } = await import("@/app/api/line/webhook/route")

function buildRequest(text: string, lineUserId = "line-user-1"): NextRequest {
  return new NextRequest("http://localhost/api/line/webhook", {
    method: "POST",
    headers: {
      "x-line-signature": "valid-signature",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      events: [
        {
          type: "message",
          source: { userId: lineUserId },
          message: { type: "text", text },
        },
      ],
    }),
  })
}

const mockExecutorExecute = vi.fn()

function installToolFirstAgentMock(lineUserId = "line-user-1"): void {
  const historyBySession = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>()

  mockExecutorExecute.mockResolvedValue({
    blocked: false,
    content: "executor fallback",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    intent: null,
    toolCalls: [],
    timings: {},
    sessionId: lineUserId,
    traceId: null,
    trace: {},
  })

  mockCreateZentropyAgent.mockImplementation(() => new ToolFirstAgent({
    executor: { execute: mockExecutorExecute } as any,
    delegate: {
      chat: vi.fn().mockResolvedValue({
        blocked: false,
        content: "delegate fallback",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        intent: null,
        toolCalls: [],
        timings: {},
        sessionId: lineUserId,
        traceId: null,
        trace: null,
      }),
    },
    sessionStore: {
      get: vi.fn(async (sessionId: string) => historyBySession.get(sessionId) ?? []),
      save: vi.fn(async (
        sessionId: string,
        history: Array<{ role: "user" | "assistant"; content: string }>,
      ) => {
        historyBySession.set(sessionId, history)
      }),
    },
    memoryManager: null,
    lineUserId,
  }))
}

describe("POST /api/line/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pendingLineSessions.clear()
    mockVerifyLineSignature.mockReturnValue(true)
    mockUserFindFirst.mockResolvedValue({ id: "user-1" })
    mockGetLineSession.mockImplementation(async (lineUserId: string) => pendingLineSessions.get(lineUserId) ?? null)
    mockClearLineSession.mockImplementation(async (lineUserId: string) => {
      pendingLineSessions.delete(lineUserId)
    })
    mockSaveLineSession.mockImplementation(async (lineUserId: string, type: string, payload: unknown) => {
      pendingLineSessions.set(lineUserId, { type, payload })
    })
    mockCompleteTaskExecute.mockResolvedValue({ task: { id: "task-1" } })
    mockUpdateSubItemExecute.mockResolvedValue({ subItem: { id: "sub-1" } })
    mockUpdatePlanItemExecute.mockResolvedValue({ item: { id: "plan-1" } })
    mockQueryTodayExecute.mockResolvedValue([
      "[FACTS]",
      "{}",
      "[/FACTS]",
      "",
      "📋 目前查到 2 項待處理項目：",
      "",
      "1. 晨跑 [健康]",
      "2. 晚間回顧 [工作]",
    ].join("\n"))
    mockQueryCompletedTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n✅ 今天已完成 1 項任務：")
    mockCreateCompleteTaskSearchTool.mockImplementation((
      _userId: string,
      _message: string,
      currentLineUserId?: string,
      resolvedQuery?: string,
    ) => ({
      execute: vi.fn(async () => {
        if (currentLineUserId) {
          await mockSaveLineSession(currentLineUserId, "complete_task_confirm", {
            sourceType: "task",
            taskId: "task-1",
            taskTitle: resolvedQuery ?? "晨跑",
          })
        }
        return `[FACTS]\n{}\n[/FACTS]\n\n是否完成「${resolvedQuery ?? "晨跑"}」？`
      }),
    }))
    mockAgentChat.mockResolvedValue({
      blocked: false,
      content: "delegate fallback",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      intent: null,
      toolCalls: [],
      timings: {},
      sessionId: "line-user-1",
      traceId: null,
      trace: null,
    })
    mockCreateZentropyAgent.mockImplementation(() => ({
      chat: mockAgentChat,
    }))
  })

  it("routes '沒錯' through complete_task_confirm instead of agent fallback", async () => {
    pendingLineSessions.set("line-user-1", {
      type: "complete_task_confirm",
      payload: {
        sourceType: "task",
        taskId: "task-1",
        taskTitle: "整理競品投影片",
      },
    })

    const request = buildRequest("沒錯")

    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockGetLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockCompleteTaskExecute).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "user-1",
    })
    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockCreateZentropyAgent).not.toHaveBeenCalled()
  })

  it("routes subtask confirmation through UpdateSubItemUseCase", async () => {
    pendingLineSessions.set("line-user-1", {
      type: "complete_task_confirm",
      payload: {
        sourceType: "sub_task",
        taskId: "task-1",
        subTaskId: "sub-1",
        taskTitle: "跑步",
      },
    })

    const request = buildRequest("確認")

    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockUpdateSubItemExecute).toHaveBeenCalledWith({
      taskId: "task-1",
      subItemId: "sub-1",
      userId: "user-1",
      completed: true,
    })
    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(mockUpdatePlanItemExecute).not.toHaveBeenCalled()
    expect(mockCreateZentropyAgent).not.toHaveBeenCalled()
  })

  it("routes daily plan item confirmation through UpdatePlanItemUseCase", async () => {
    pendingLineSessions.set("line-user-1", {
      type: "complete_task_confirm",
      payload: {
        sourceType: "daily_plan_item",
        planItemId: "plan-1",
        taskTitle: "晨間回顧",
      },
    })

    const request = buildRequest("對")

    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockUpdatePlanItemExecute).toHaveBeenCalledWith({
      itemId: "plan-1",
      userId: "user-1",
      completed: true,
    })
    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(mockUpdateSubItemExecute).not.toHaveBeenCalled()
  })

  it("completes a contextual subtask through webhook conversation flow", async () => {
    installToolFirstAgentMock()
    mockExecutorExecute.mockImplementation(async (input: any) => {
      if (input.intent?.object === "task_completion") {
        await mockSaveLineSession("line-user-1", "complete_task_confirm", {
          sourceType: "sub_task",
          taskId: "task-1",
          subTaskId: "sub-1",
          taskTitle: "晨跑",
        })
        return {
          blocked: false,
          content: "是否完成「晨跑」？\n\n回覆「確認」執行，或無視此訊息取消。",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          intent: input.intent,
          toolCalls: ["complete_task_search"],
          timings: {},
          sessionId: input.sessionId,
          traceId: null,
          trace: {},
        }
      }
      return {
        blocked: false,
        content: "executor fallback",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        intent: input.intent,
        toolCalls: [],
        timings: {},
        sessionId: input.sessionId,
        traceId: null,
        trace: {},
      }
    })

    await POST(buildRequest("今天要做什麼？"))
    await flushAsyncWork()

    await POST(buildRequest("這件事跑完了"))
    await flushAsyncWork()

    await POST(buildRequest("確認"))
    await flushAsyncWork()

    expect(mockQueryTodayExecute).toHaveBeenCalledWith({})
    expect(mockExecutorExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: expect.objectContaining({ object: "task_completion" }),
      }),
    )
    expect(mockUpdateSubItemExecute).toHaveBeenCalledWith({
      taskId: "task-1",
      subItemId: "sub-1",
      userId: "user-1",
      completed: true,
    })
    expect(mockCreateZentropyAgent).toHaveBeenCalledTimes(2)
  })

  // ── Sprint 2: Regression Cases A-E ──────────────────────────────────────

  it("Case A: pending session + reject phrase → session cleared, use case not called", async () => {
    pendingLineSessions.set("line-user-1", {
      type: "complete_task_confirm",
      payload: {
        sourceType: "task",
        taskId: "task-1",
        taskTitle: "整理報告",
      },
    })

    const request = buildRequest("算了")
    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(mockUpdateSubItemExecute).not.toHaveBeenCalled()
    expect(mockUpdatePlanItemExecute).not.toHaveBeenCalled()
    expect(mockCreateZentropyAgent).not.toHaveBeenCalled()
    expect(mockPushMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ type: "text", text: "好的，已取消。" }],
      }),
    )
  })

  it("Case A2: pending session + '取消' → session cleared, cancel message pushed", async () => {
    pendingLineSessions.set("line-user-1", {
      type: "adjust_tags_preview",
      payload: { intentType: "move", taskMatches: [], logId: "log-1" },
    })

    const request = buildRequest("取消")
    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockCreateZentropyAgent).not.toHaveBeenCalled()
    expect(mockPushMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ type: "text", text: "好的，已取消。" }],
      }),
    )
  })

  it("Case B: pending session + override new intent → session cleared, agent called", async () => {
    pendingLineSessions.set("line-user-1", {
      type: "complete_task_confirm",
      payload: {
        sourceType: "task",
        taskId: "task-1",
        taskTitle: "整理報告",
      },
    })

    mockAgentChat.mockResolvedValue({
      blocked: false,
      content: "已記錄：改成跑步",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      intent: null,
      toolCalls: ["brain_dump"],
      timings: {},
      sessionId: "line-user-1",
      traceId: null,
      trace: null,
    })

    const request = buildRequest("改成跑步")
    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(mockCreateZentropyAgent).toHaveBeenCalled()
    expect(mockAgentChat).toHaveBeenCalledWith("改成跑步", expect.any(Object))
  })

  it("Case C: no pending session + '沒錯' → agent flow, no use case called", async () => {
    expect(pendingLineSessions.size).toBe(0)

    mockAgentChat.mockResolvedValue({
      blocked: false,
      content: "你好，有什麼可以幫你的嗎？",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      intent: null,
      toolCalls: [],
      timings: {},
      sessionId: "line-user-1",
      traceId: null,
      trace: null,
    })

    const request = buildRequest("沒錯")
    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(mockUpdateSubItemExecute).not.toHaveBeenCalled()
    expect(mockUpdatePlanItemExecute).not.toHaveBeenCalled()
    expect(mockCreateZentropyAgent).toHaveBeenCalled()
  })

  it("Case D: capture input '幫我記一下要跑步' → agent called, complete_task_search not called", async () => {
    mockAgentChat.mockResolvedValue({
      blocked: false,
      content: "已記錄：跑步",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      intent: null,
      toolCalls: ["brain_dump"],
      timings: {},
      sessionId: "line-user-1",
      traceId: null,
      trace: null,
    })

    const request = buildRequest("幫我記一下要跑步")
    const response = await POST(request)

    expect(response.status).toBe(200)
    await flushAsyncWork()

    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(mockCreateZentropyAgent).toHaveBeenCalled()
    expect(pendingLineSessions.size).toBe(0)
  })

  it("Case E: query then capture input → no pending session created for capture", async () => {
    mockAgentChat.mockResolvedValueOnce({
      blocked: false,
      content: "今天有 2 件事要做",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      intent: null,
      toolCalls: ["query_tasks"],
      timings: {},
      sessionId: "line-user-1",
      traceId: null,
      trace: null,
    })

    await POST(buildRequest("今天要做什麼？"))
    await flushAsyncWork()

    mockAgentChat.mockResolvedValueOnce({
      blocked: false,
      content: "已記錄：準備報告",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      intent: null,
      toolCalls: ["brain_dump"],
      timings: {},
      sessionId: "line-user-1",
      traceId: null,
      trace: null,
    })

    await POST(buildRequest("幫我記準備報告"))
    await flushAsyncWork()

    expect(mockCompleteTaskExecute).not.toHaveBeenCalled()
    expect(pendingLineSessions.size).toBe(0)
  })

  it("completes a contextual daily plan item through webhook conversation flow", async () => {
    installToolFirstAgentMock()
    mockQueryTodayExecute.mockResolvedValue([
      "[FACTS]",
      "{}",
      "[/FACTS]",
      "",
      "📋 目前查到 2 項待處理項目：",
      "",
      "1. 晨間回顧 [工作]",
      "2. 晚間回顧 [工作]",
    ].join("\n"))
    mockExecutorExecute.mockImplementation(async (input: any) => {
      if (input.intent?.object === "task_completion") {
        await mockSaveLineSession("line-user-1", "complete_task_confirm", {
          sourceType: "daily_plan_item",
          planItemId: "plan-1",
          taskTitle: "晨間回顧",
        })
        return {
          blocked: false,
          content: "是否完成「晨間回顧」？\n\n回覆「確認」執行，或無視此訊息取消。",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          intent: input.intent,
          toolCalls: ["complete_task_search"],
          timings: {},
          sessionId: input.sessionId,
          traceId: null,
          trace: {},
        }
      }
      return {
        blocked: false,
        content: "executor fallback",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        intent: input.intent,
        toolCalls: [],
        timings: {},
        sessionId: input.sessionId,
        traceId: null,
        trace: {},
      }
    })

    await POST(buildRequest("今天要做什麼？"))
    await flushAsyncWork()

    await POST(buildRequest("這件事跑完了"))
    await flushAsyncWork()

    await POST(buildRequest("確認"))
    await flushAsyncWork()

    expect(mockExecutorExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: expect.objectContaining({ object: "task_completion" }),
      }),
    )
    expect(mockUpdatePlanItemExecute).toHaveBeenCalledWith({
      itemId: "plan-1",
      userId: "user-1",
      completed: true,
    })
    expect(mockUpdateSubItemExecute).not.toHaveBeenCalled()
  })
})
