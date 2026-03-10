import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToolFirstAgent } from "@/application/use-cases/agent/tool-first-agent"

const {
  mockBrainDumpExecute,
  mockQueryTodayExecute,
  mockQueryCompletedTodayExecute,
  mockCompleteTaskSearchExecute,
  mockCreateCompleteTaskSearchTool,
} = vi.hoisted(() => ({
  mockBrainDumpExecute: vi.fn(),
  mockQueryTodayExecute: vi.fn(),
  mockQueryCompletedTodayExecute: vi.fn(),
  mockCompleteTaskSearchExecute: vi.fn(),
  mockCreateCompleteTaskSearchTool: vi.fn(),
}))

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpTool: vi.fn(() => ({
    execute: mockBrainDumpExecute,
  })),
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
}))

describe("ToolFirstAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：跟客戶開產品 review 會議")
    mockQueryTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📋 目前查到 1 項待處理項目：")
    mockQueryCompletedTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n✅ 今天已完成 1 項任務：")
    mockCompleteTaskSearchExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n是否完成「整理競品投影片」？")
    mockCreateCompleteTaskSearchTool.mockReturnValue({
      execute: mockCompleteTaskSearchExecute,
    })
  })

  it("routes today's todo query through query_today_tasks", async () => {
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        blocked: false,
        content: "delegate fallback",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        intent: null,
        toolCalls: [],
        timings: {},
        sessionId: "line-user-1",
        traceId: null,
        trace: null,
      }),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
    })

    const result = await agent.chat("今天的代辦事項為何？", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockQueryTodayExecute).toHaveBeenCalledWith({})
    expect(mockQueryCompletedTodayExecute).not.toHaveBeenCalled()
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["query_today_tasks"])
    expect(result.content).toContain("目前查到 1 項待處理項目")
  })

  it("routes capture requests through brain_dump via intent resolver", async () => {
    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
    })

    const result = await agent.chat("幫我記一下明天下午要跟客戶開產品 review 會議", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockBrainDumpExecute).toHaveBeenCalledWith({})
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["brain_dump"])
    expect(result.content).toContain("已記錄 1 個項目")
  })

  it("routes completion collision through complete_task_search instead of completed-today query", async () => {
    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("我今天已經跑完步了，幫我標記完成", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockQueryCompletedTodayExecute).not.toHaveBeenCalled()
    expect(mockCreateCompleteTaskSearchTool).toHaveBeenCalledWith(
      "user-1",
      "我今天已經跑完步了，幫我標記完成",
      "line-user-1",
      "跑步",
    )
    expect(result.toolCalls).toEqual(["complete_task_search"])
  })

  it("resolves contextual completion requests from session history", async () => {
    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: "📋 目前查到 2 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]",
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("把這件事標記完成啊", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateCompleteTaskSearchTool).toHaveBeenCalledWith(
      "user-1",
      "把這件事標記完成啊",
      "line-user-1",
      "跑步",
    )
    expect(mockCompleteTaskSearchExecute).toHaveBeenCalledWith({})
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.content).toContain("是否完成")
  })

  it("does not invoke the resolver for underspecified short record input", async () => {
    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const intentResolver = {
      resolve: vi.fn().mockRejectedValue(new Error("should not be called")),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
      intentResolver,
    })

    const result = await agent.chat("記", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(intentResolver.resolve).not.toHaveBeenCalled()
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual([])
    expect(result.content).toContain("請直接告訴我要記錄的內容")
  })
})
