import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToolFirstAgent } from "@/application/use-cases/agent/tool-first-agent"

const {
  mockBrainDumpExecute,
  mockQueryTodayExecute,
  mockQueryCompletedTodayExecute,
  mockCompleteTaskSearchExecute,
  mockCreateCompleteTaskSearchTool,
  mockGetLineSession,
  mockClearLineSession,
  mockSaveLineSession,
} = vi.hoisted(() => ({
  mockBrainDumpExecute: vi.fn(),
  mockQueryTodayExecute: vi.fn(),
  mockQueryCompletedTodayExecute: vi.fn(),
  mockCompleteTaskSearchExecute: vi.fn(),
  mockCreateCompleteTaskSearchTool: vi.fn(),
  mockGetLineSession: vi.fn(),
  mockClearLineSession: vi.fn(),
  mockSaveLineSession: vi.fn(),
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

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  clearLineSession: mockClearLineSession,
  saveLineSession: mockSaveLineSession,
}))

vi.mock("@/lib/line-confirmation", () => ({
  classifyConfirmationDisposition: vi.fn(() => "override"),
}))

vi.mock("@/application/use-cases/adjust-tags/execute-adjustment", () => ({
  ExecuteAdjustmentUseCase: vi.fn(),
}))

vi.mock("@/application/use-cases/tasks/complete-task", () => ({
  CompleteTaskUseCase: vi.fn(),
}))

vi.mock("@/application/use-cases/tasks/update-sub-item", () => ({
  UpdateSubItemUseCase: vi.fn(),
}))

vi.mock("@/application/use-cases/coach/update-plan-item", () => ({
  UpdatePlanItemUseCase: vi.fn(),
}))

describe("ToolFirstAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLineSession.mockResolvedValue(null)
    mockClearLineSession.mockResolvedValue(undefined)
    mockSaveLineSession.mockResolvedValue(undefined)
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

  it("routes task_completion intent to executor (not direct tool route)", async () => {
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        blocked: false,
        content: "是否完成「跑步」？",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        intent: { object: "task_completion" },
        toolCalls: ["complete_task_search"],
        timings: { executor_ms: 300 },
        sessionId: "line-user-1",
        traceId: null,
        trace: {},
      }),
    }

    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      executor: mockExecutor as any,
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
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "我今天已經跑完步了，幫我標記完成",
        intent: expect.objectContaining({ object: "task_completion" }),
      }),
    )
    expect(result.toolCalls).toEqual(["complete_task_search"])
  })

  it("resolves '把第一個標記完成' deterministically using history mentions", async () => {
    const mockExecutor = {
      execute: vi.fn(),
    }

    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「跑步」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

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
      executor: mockExecutor as any,
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("把第一個標記完成", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    // 確定性解析：不走 executor，直接呼叫 complete_task_search
    expect(mockExecutor.execute).not.toHaveBeenCalled()
    expect(mockCompleteTaskSearchExecute).toHaveBeenCalledWith({})
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.content).toContain("跑步")
    expect(result.content).not.toContain("[FACTS]")
  })

  it("routes planning intent to executor instead of canned response", async () => {
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        blocked: false,
        content: "✅ 規劃完成！共建立 3 個任務",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        intent: { object: "planning" },
        toolCalls: ["run_planner"],
        timings: { executor_ms: 500 },
        sessionId: "line-user-1",
        traceId: null,
        trace: {},
      }),
    }

    const delegate = {
      chat: vi.fn(),
    }

    const sessionStore = {
      get: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      executor: mockExecutor as any,
      delegate,
      sessionStore,
      memoryManager: null,
    })

    const result = await agent.chat("幫我規劃健身計畫", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(delegate.chat).not.toHaveBeenCalled()
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "幫我規劃健身計畫",
        intent: expect.objectContaining({ object: "planning" }),
        sessionId: "line-user-1",
      }),
    )
    expect(result.toolCalls).toEqual(["run_planner"])
    expect(result.content).toContain("規劃完成")
  })

  it("falls back to delegate when no executor and planning intent", async () => {
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

    const result = await agent.chat("幫我規劃健身計畫", {
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
      executor: { execute: vi.fn() } as any,
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
          content: "📋 目前查到 3 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]\n3. 寫報告 [工作]",
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      executor: { execute: vi.fn() } as any,
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個做完了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCompleteTaskSearchExecute).toHaveBeenCalled()
    expect(result.toolCalls).toEqual(["complete_task_search"])
    expect(result.content).toContain("買牛奶")
  })

  it("keeps ordinal resolution bound to the last actual list, not latest preview facts", async () => {
    mockCompleteTaskSearchExecute.mockResolvedValue(
      "[FACTS]\n{}\n[/FACTS]\n\n是否完成「買牛奶」？\n\n回覆「確認」執行，或無視此訊息取消。",
    )

    const sessionStore = {
      get: vi.fn().mockResolvedValue([
        {
          role: "assistant",
          content: "📋 目前查到 3 項待處理項目：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]\n3. 寫報告 [工作]",
        },
        {
          role: "assistant",
          content: '[FACTS]\n{"selectedTaskTitle":"跑步","candidates":[{"title":"跑步"},{"title":"晨跑"}]}\n[/FACTS]\n\n是否完成「跑步」？',
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      executor: { execute: vi.fn() } as any,
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個做完了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCompleteTaskSearchExecute).toHaveBeenCalled()
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
            { position: 1, title: "跑步", entityId: "a", entityType: "task" },
            { position: 2, title: "買牛奶", entityId: "b", entityType: "task" },
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
      executor: { execute: vi.fn() } as any,
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

    expect(mockCompleteTaskSearchExecute).toHaveBeenCalled()
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
          content: "找到多個可能的候選任務，但目前不足以安全判定要完成哪一筆：\n\n1. 發 email 給客戶 [測試任務]\n2. 發 email 給客戶 [測試任務]\n3. 收集新用戶的必要資訊 [未分類]\n\n請直接回覆更精確的任務名稱。",
        },
      ]),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const agent = new ToolFirstAgent({
      executor: { execute: vi.fn() } as any,
      delegate: { chat: vi.fn() },
      sessionStore,
      memoryManager: null,
      lineUserId: "line-user-1",
    })

    const result = await agent.chat("第二個也搞定了", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(mockCompleteTaskSearchExecute).toHaveBeenCalled()
    expect(result.content).toContain("發 email 給客戶")
    expect(result.content).not.toContain("收集新用戶")
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
      executor: { execute: vi.fn() } as any,
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
    expect(mockSaveLineSession).toHaveBeenCalledWith("line-user-1", "complete_task_confirm", {
      sourceType: "sub_task",
      taskTitle: "整理履歷並更新 LinkedIn",
      taskId: "task-1",
      subTaskId: "sub-1",
      planItemId: undefined,
    })
    expect(result.content).toContain("整理履歷並更新 LinkedIn")
  })
})
