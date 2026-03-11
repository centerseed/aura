import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToolFirstAgent } from "@/application/use-cases/agent/tool-first-agent"
import { normalizeCompletionQuery } from "@/application/use-cases/agent/completion-query-normalizer"
import { classifyConfirmationDisposition } from "@/lib/line-confirmation"

const {
  mockBrainDumpExecute,
  mockQueryTodayExecute,
  mockQueryCompletedTodayExecute,
  mockCreateQueryTodayTasksTool,
  mockCompleteTaskSearchExecute,
  mockCreateCompleteTaskSearchTool,
  mockAdjustTagsExecute,
  mockCreateAdjustTagsTool,
  mockRunPlannerExecute,
  mockGetLineSession,
  mockClearLineSession,
  mockSaveLineSession,
  mockExecuteCompleteTaskPayload,
} = vi.hoisted(() => ({
  mockBrainDumpExecute: vi.fn(),
  mockQueryTodayExecute: vi.fn(),
  mockQueryCompletedTodayExecute: vi.fn(),
  mockCreateQueryTodayTasksTool: vi.fn(),
  mockCompleteTaskSearchExecute: vi.fn(),
  mockCreateCompleteTaskSearchTool: vi.fn(),
  mockAdjustTagsExecute: vi.fn(),
  mockCreateAdjustTagsTool: vi.fn(),
  mockRunPlannerExecute: vi.fn(),
  mockGetLineSession: vi.fn(),
  mockClearLineSession: vi.fn(),
  mockSaveLineSession: vi.fn(),
  mockExecuteCompleteTaskPayload: vi.fn(),
}))

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpTool: vi.fn(() => ({
    execute: mockBrainDumpExecute,
  })),
}))

vi.mock("@/application/use-cases/agent/query-tasks-skill", () => ({
  createQueryTodayTasksTool: mockCreateQueryTodayTasksTool,
  createQueryCompletedTodayTasksTool: vi.fn(() => ({
    execute: mockQueryCompletedTodayExecute,
  })),
}))

vi.mock("@/application/use-cases/agent/complete-task-skill", () => ({
  createCompleteTaskSearchTool: mockCreateCompleteTaskSearchTool,
}))

vi.mock("@/application/use-cases/agent/planner-skill", () => ({
  createRunPlannerTool: vi.fn(() => ({
    execute: mockRunPlannerExecute,
  })),
}))

vi.mock("@/application/use-cases/agent/adjust-tags-skill", () => ({
  createAdjustTagsTool: mockCreateAdjustTagsTool,
}))

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  clearLineSession: mockClearLineSession,
  saveLineSession: mockSaveLineSession,
}))

vi.mock("@/lib/line-confirmation", () => ({
  classifyConfirmationDisposition: vi.fn(() => "override"),
  extractBrainDumpConfirmationTarget: vi.fn((text: string) => {
    const match = text.match(/你想要我記錄「([^」]+)」嗎/u)
    return match?.[1] ?? null
  }),
}))

vi.mock("@/application/use-cases/adjust-tags/execute-adjustment", () => ({
  ExecuteAdjustmentUseCase: vi.fn(),
}))

vi.mock("@/application/use-cases/agent/complete-task-executor", () => ({
  executeCompleteTaskPayload: mockExecuteCompleteTaskPayload,
  buildCompleteTaskSuccessMessage: vi.fn((taskTitle: string) => `✅ 已完成「${taskTitle}」`),
}))

describe("ToolFirstAgent", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    vi.mocked(classifyConfirmationDisposition).mockReturnValue("override")
    mockGetLineSession.mockResolvedValue(null)
    mockClearLineSession.mockResolvedValue(undefined)
    mockSaveLineSession.mockResolvedValue(undefined)
    mockExecuteCompleteTaskPayload.mockResolvedValue(undefined)
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：跟客戶開產品 review 會議")
    mockQueryTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📋 目前查到 1 項待處理項目：")
    mockCreateQueryTodayTasksTool.mockReturnValue({
      execute: mockQueryTodayExecute,
    })
    mockQueryCompletedTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n✅ 今天已完成 1 項任務：")
    mockCompleteTaskSearchExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n是否完成「整理競品投影片」？")
    mockAdjustTagsExecute.mockResolvedValue("📋 調整預覽：\n\n將「買牛奶」\n從 一般 / 家務\n移到 一般 / 個人\n\n回覆「確認」執行，或無視此訊息取消。")
    mockRunPlannerExecute.mockResolvedValue("✅ 規劃完成！共建立 3 個任務")
    mockCreateCompleteTaskSearchTool.mockReturnValue({
      execute: mockCompleteTaskSearchExecute,
    })
    mockCreateAdjustTagsTool.mockReturnValue({
      execute: mockAdjustTagsExecute,
    })
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it("normalizes repeated completion phrasing without duplicated verb tails", () => {
    expect(normalizeCompletionQuery("跑步跑完了")).toBe("跑步")
    expect(normalizeCompletionQuery("寫報告寫完了")).toBe("寫報告")
    expect(normalizeCompletionQuery("繳電費繳掉了")).toBe("繳電費")
    expect(normalizeCompletionQuery("幫我把買牛奶標記完成")).toBe("買牛奶")
  })

  it("normalizes completion messages into task queries", () => {
    expect(normalizeCompletionQuery("跑步完成了")).toBe("跑步")
    expect(normalizeCompletionQuery("幫我把買牛奶標記完成")).toBe("買牛奶")
    expect(normalizeCompletionQuery("健身房做完了")).toBe("健身房")
    expect(normalizeCompletionQuery("我今天已經跑完步了，幫我標記完成")).toBe("跑步")
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
    expect(result.timings).toEqual(expect.objectContaining({
      session_history_load_ms: expect.any(Number),
      intent_resolve_ms: expect.any(Number),
      direct_route_ms: expect.any(Number),
      total_ms: expect.any(Number),
    }))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("\"event\":\"tool_first_agent_chat_complete\""))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("\"route\":\"direct_tool\""))
  })

  it("uses strict-today query mode for unfinished-today phrasing", async () => {
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

    await agent.chat("我今天還有哪些沒做完的事情？", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateQueryTodayTasksTool).toHaveBeenCalledWith("user-1", {
      strictToday: true,
      dayOffset: undefined,
    })
  })

  it("routes tomorrow queries to tomorrow-only task scope", async () => {
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

    await agent.chat("明天有哪些任務", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateQueryTodayTasksTool).toHaveBeenCalledWith("user-1", {
      strictToday: false,
      dayOffset: 1,
    })
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

  it("stores a pending brain-dump session when delegate asks for capture confirmation", async () => {
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        blocked: false,
        content: "你想要我記錄「修復embedded問題」嗎？請確認是否要建立新的任務。\n\n或者您可以直接說：\n記錄：修復embedded問題",
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
      lineUserId: "line-user-1",
    })

    await agent.chat("修復embedded問題", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockSaveLineSession).toHaveBeenCalledWith("line-user-1", "brain_dump_pending", {
      originalText: "修復embedded問題",
      taskTitle: "修復embedded問題",
    })
  })

  it("executes a pending brain-dump confirmation instead of delegating on '是的'", async () => {
    vi.mocked(classifyConfirmationDisposition).mockReturnValue("confirm")
    mockGetLineSession.mockResolvedValue({
      type: "brain_dump_pending",
      payload: {
        originalText: "修復embedded問題",
        taskTitle: "修復embedded問題",
      },
    })
    mockBrainDumpExecute.mockResolvedValue("[FACTS]\n{\"recordedItems\":[{\"title\":\"修復embedded問題\",\"sourceType\":\"task\",\"taskId\":\"task-1\"}]}\n[/FACTS]\n\n✅ 已記錄 1 個項目：修復embedded問題")

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

    const result = await agent.chat("是的", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockBrainDumpExecute).toHaveBeenCalledWith({})
    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["brain_dump"])
    expect(result.content).toBe("✅ 已記錄 1 個項目：修復embedded問題")
  })

  it("clears pending brain-dump confirmation on reject", async () => {
    vi.mocked(classifyConfirmationDisposition).mockReturnValue("reject")
    mockGetLineSession.mockResolvedValue({
      type: "brain_dump_pending",
      payload: {
        originalText: "修復embedded問題",
        taskTitle: "修復embedded問題",
      },
    })

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

    const result = await agent.chat("不要", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockBrainDumpExecute).not.toHaveBeenCalled()
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual([])
    expect(result.content).toBe("好的，已取消。")
  })

  it("clears pending brain-dump confirmation on override and delegates new intent", async () => {
    vi.mocked(classifyConfirmationDisposition).mockReturnValue("override")
    mockGetLineSession.mockResolvedValue({
      type: "brain_dump_pending",
      payload: {
        originalText: "修復embedded問題",
        taskTitle: "修復embedded問題",
      },
    })

    const delegate = {
      chat: vi.fn().mockResolvedValue({
        blocked: false,
        content: "delegate response",
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
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("改成修 API 問題", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(mockBrainDumpExecute).not.toHaveBeenCalled()
    expect(delegate.chat).toHaveBeenCalled()
    expect(result.content).toBe("delegate response")
  })

  it("executes a pending complete-task confirmation with execution proof", async () => {
    vi.mocked(classifyConfirmationDisposition).mockReturnValue("confirm")
    mockGetLineSession.mockResolvedValue({
      type: "complete_task_confirm",
      payload: {
        sourceType: "task",
        taskTitle: "準備下週簡報",
        taskId: "task-1",
      },
    })

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

    const result = await agent.chat("確認", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "準備下週簡報",
      taskId: "task-1",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockClearLineSession).toHaveBeenCalledWith("line-user-1")
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.toolOutputs).toEqual(["✅ 已完成「準備下週簡報」"])
    expect(result.content).toBe("✅ 已完成「準備下週簡報」")
    expect(result.trace).toMatchObject({
      selectedTool: "complete_task_search",
      routeSource: "pending_confirmation",
    })
  })

  it("routes explicit task_completion intent through complete_task_search", async () => {
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
    expect(delegate.chat).not.toHaveBeenCalled()
    expect(mockCreateCompleteTaskSearchTool).toHaveBeenCalledWith(
      "user-1",
      "跑步",
      "line-user-1",
    )
    expect(mockCompleteTaskSearchExecute).toHaveBeenCalledWith({})
    expect(result.toolCalls).toEqual(["complete_task_search"])
  })

  it("uses normalized completion query for direct completion fallback", async () => {
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

    await agent.chat("幫我把買牛奶標記完成", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateCompleteTaskSearchTool).toHaveBeenCalledWith(
      "user-1",
      "買牛奶",
      "line-user-1",
    )
  })

  it("routes multi-clause completion phrasing through the normalized query", async () => {
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

    await agent.chat("我今天已經把 API 文件整理好了，幫我標記完成", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateCompleteTaskSearchTool).toHaveBeenCalledWith(
      "user-1",
      "api 文件整理",
      "line-user-1",
    )
  })

  it("routes code-switching completion phrasing with explicit completion cue through the normalized query", async () => {
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        blocked: false,
        content: "delegate response",
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
      lineUserId: "line-user-1",
    })

    await agent.chat("剛剛把 email 寄給客戶 done 了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateCompleteTaskSearchTool).toHaveBeenCalledWith(
      "user-1",
      "email寄給客戶",
      "line-user-1",
    )
  })

  it("resolves '把第一個標記完成' deterministically using history mentions", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「跑步」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"跑步","entityId":"task-1","entityType":"task","taskId":"task-1"},{"position":2,"title":"買牛奶","entityId":"task-2","entityType":"task","taskId":"task-2"}]}\n[/FACTS]\n\n📋 目前查到 2 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("把第一個標記完成", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "跑步",
      taskId: "task-1",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.content).toContain("跑步")
    expect(result.content).not.toContain("[FACTS]")
  })

  it("routes planning intent through run_planner directly", async () => {
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

    const result = await agent.chat("幫我規劃健身計畫", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(delegate.chat).not.toHaveBeenCalled()
    expect(mockRunPlannerExecute).toHaveBeenCalledWith({})
    expect(result.toolCalls).toEqual(["run_planner"])
    expect(result.content).toContain("規劃完成")
  })

  it("falls back to delegate for unresolved generic input", async () => {
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        blocked: false,
        content: "delegate response",
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

    const result = await agent.chat("今天天氣真好", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(delegate.chat).toHaveBeenCalled()
    expect(result.content).toBe("delegate response")
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

  it("resolves '剛才記的那個完成了' using recorded items from history", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「繳電費」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        { role: "user", content: "幫我記一下繳電費" },
        { role: "assistant", content: "✅ 已記錄 1 個項目：繳電費" },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("剛才記的那個完成了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCompleteTaskSearchExecute).toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.content).toContain("繳電費")
  })

  it("resolves '第二個做完了' to second item in mention list", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「買牛奶」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"跑步","entityId":"task-1","entityType":"task","taskId":"task-1"},{"position":2,"title":"買牛奶","entityId":"task-2","entityType":"task","taskId":"task-2"},{"position":3,"title":"寫報告","entityId":"task-3","entityType":"task","taskId":"task-3"}]}\n[/FACTS]\n\n📋 目前查到 3 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]\n3. 寫報告 [工作]',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個做完了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "買牛奶",
      taskId: "task-2",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.content).toContain("買牛奶")
  })

  it("asks for list clarification when '最後一個' cannot be safely resolved from the latest list", async () => {
    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"跑步","entityId":"task-1","entityType":"task","taskId":"task-1"},{"position":2,"title":"買牛奶","entityId":"task-2","entityType":"task","taskId":"task-2"},{"position":3,"title":"寫報告","entityId":"task-3","entityType":"task","taskId":"task-3"}]}\n[/FACTS]\n\n📋 目前查到 3 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]\n3. 寫報告 [工作]',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("最後一個做完了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockSaveLineSession).not.toHaveBeenCalled()
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual([])
    expect(result.content).toContain("你是指清單中的哪一個")
    expect(result.content).toContain("序號或完整名稱")
  })

  it("keeps ordinal resolution bound to the last actual list, not latest preview facts", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「買牛奶」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"跑步","entityId":"task-1","entityType":"task","taskId":"task-1"},{"position":2,"title":"買牛奶","entityId":"task-2","entityType":"task","taskId":"task-2"},{"position":3,"title":"寫報告","entityId":"task-3","entityType":"task","taskId":"task-3"}]}\n[/FACTS]\n\n📋 目前查到 3 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]\n3. 寫報告 [工作]',
        },
        {
          role: "assistant",
          content: '[FACTS]\n{"selectedTaskTitle":"跑步","candidates":[{"title":"跑步"},{"title":"晨跑"}]}\n[/FACTS]\n\n是否完成「跑步」？',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個做完了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "買牛奶",
      taskId: "task-2",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.content).toContain("買牛奶")
  })

  it("uses persisted session state for ordinal resolution even when history has no list", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「買牛奶」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const metaStore = {
      get: vi.fn().mockResolvedValue({
        lastActivityAt: null,
        currentSegmentId: 1,
        lastFlushedSegmentId: null,
        lastFlushAt: null,
        agentState: {
          lastPresentedEntities: [
            { position: 1, title: "跑步", entityId: "a", entityType: "task", taskId: "a" },
            { position: 2, title: "買牛奶", entityId: "b", entityType: "task", taskId: "b" },
          ],
          lastRecordedEntities: [],
        },
      }),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      metaStore: metaStore as any,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個做完了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "買牛奶",
      taskId: "b",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.content).toContain("買牛奶")
  })

  it("preserves duplicate positions in the presented list instead of de-duping ordinal slots", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「發 email 給客戶」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"發 email 給客戶","entityId":"task-a","entityType":"task","taskId":"task-a"},{"position":2,"title":"發 email 給客戶","entityId":"task-b","entityType":"task","taskId":"task-b"},{"position":3,"title":"收集新用戶的必要資訊","entityId":"task-c","entityType":"task","taskId":"task-c"}]}\n[/FACTS]\n\n我找到多個可能的任務，請告訴我是下面哪一個：\n\n1. 發 email 給客戶 [測試任務]\n2. 發 email 給客戶 [測試任務]\n3. 收集新用戶的必要資訊 [未分類]\n\n你可以直接回覆序號，或回覆完整任務名稱。',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個也搞定了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "發 email 給客戶",
      taskId: "task-b",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.content).toContain("發 email 給客戶")
    expect(result.content).not.toContain("收集新用戶")
  })

  it("treats bare numeric replies as selection from the latest disambiguation list", async () => {
    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"與 Rebecca 安排 1 on 1 會議","entityId":"task-a","entityType":"task","taskId":"task-a"},{"position":2,"title":"與吳柏宗安排 1 on 1 會議","entityId":"task-b","entityType":"task","taskId":"task-b"},{"position":3,"title":"與客戶安排 1 on 1 會議","entityId":"task-c","entityType":"task","taskId":"task-c"}]}\n[/FACTS]\n\n我找到多個可能的任務，請告訴我是下面哪一個：\n\n1. 與 Rebecca 安排 1 on 1 會議 [BNI]\n2. 與吳柏宗安排 1 on 1 會議 [BNI]\n3. 與客戶安排 1 on 1 會議 [BNI]\n\n你可以直接回覆序號，或回覆完整任務名稱。',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("2", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "與吳柏宗安排 1 on 1 會議",
      taskId: "task-b",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(result.content).toContain("與吳柏宗安排 1 on 1 會議")
  })

  it("resolves recall/completion from structured brain dump facts instead of summary text", async () => {
    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"action":"append_sub_item","recordedItems":[{"title":"整理履歷並更新 LinkedIn","source":"appended","sourceType":"sub_task","taskId":"task-1","subTaskId":"sub-1"}]}\n[/FACTS]\n\n✅ 已記錄並追加：「整理履歷並更新 LinkedIn」追加 1 個待辦',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("幫我把剛才記的那個標記完成", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "sub_task",
      taskTitle: "整理履歷並更新 LinkedIn",
      taskId: "task-1",
      subTaskId: "sub-1",
      planItemId: undefined,
    })
    expect(result.content).toContain("整理履歷並更新 LinkedIn")
  })

  it("resolves bare completion statements against the latest single recorded item", async () => {
    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"recordedItems":[{"title":"清理電腦桌面","sourceType":"task","taskId":"task-1"}]}\n[/FACTS]\n\n✅ 已記錄 1 個項目：清理電腦桌面',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("搞定了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCompleteTaskSearchExecute).not.toHaveBeenCalled()
    expect(mockExecuteCompleteTaskPayload).toHaveBeenCalledWith("user-1", {
      sourceType: "task",
      taskTitle: "清理電腦桌面",
      taskId: "task-1",
      subTaskId: undefined,
      planItemId: undefined,
    })
    expect(result.content).toContain("清理電腦桌面")
  })

  it("answers recall phrasing variation without invoking brain dump", async () => {
    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"recordedItems":[{"title":"準備下週簡報","sourceType":"task","taskId":"task-1"}]}\n[/FACTS]\n\n✅ 已記錄 1 個項目：準備下週簡報',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const delegate = {
      chat: vi.fn(),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("你幫我記了什麼？", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(delegate.chat).not.toHaveBeenCalled()
    expect(mockBrainDumpExecute).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual([])
    expect(result.content).toBe("你剛才記的是：準備下週簡報")
  })

  it("asks for task name instead of running adjust-tags on pure contextual reference without context", async () => {
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
      intentResolver: {
        resolve: vi.fn().mockResolvedValue({
          intent: { object: "classification", requiresConfirmation: false, confidence: 0.8 },
          trace: {
            routeSource: "intent_resolver",
            resolver: "test",
            rawMessage: "把這個任務移到個人",
            resolvedIntent: { object: "classification", requiresConfirmation: false, confidence: 0.8 },
            selectedTool: null,
            targetQuery: null,
          },
        }),
      },
    })

    const result = await agent.chat("把這個任務移到個人", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(delegate.chat).not.toHaveBeenCalled()
    expect(result.toolCalls).toEqual([])
    expect(result.content).toContain("我還不知道你指的是哪個任務")
  })

  it("passes canonical task context into adjust-tags for contextual references", async () => {
    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: '[FACTS]\n{"presentedEntities":[{"position":1,"title":"買牛奶","entityId":"task-2","entityType":"task","taskId":"task-2"}]}\n[/FACTS]\n\n📋 目前查到 1 項待處理項目：\n\n1. 買牛奶 [家務]',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      delegate,
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
      intentResolver: {
        resolve: vi.fn().mockResolvedValue({
          intent: { object: "classification", requiresConfirmation: false, confidence: 0.8 },
          trace: {
            routeSource: "intent_resolver",
            resolver: "test",
            rawMessage: "把這個任務移到個人",
            resolvedIntent: { object: "classification", requiresConfirmation: false, confidence: 0.8 },
            selectedTool: null,
            targetQuery: null,
          },
        }),
      },
    })

    const result = await agent.chat("把這個任務移到個人", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCreateAdjustTagsTool).toHaveBeenCalledWith(
      "user-1",
      "把這個任務移到個人",
      "line-user-1",
      expect.objectContaining({
        title: "買牛奶",
        taskId: "task-2",
      }),
    )
    expect(mockAdjustTagsExecute).toHaveBeenCalledWith({})
    expect(result.toolCalls).toEqual(["adjust_tags_preview"])
  })
})
