/**
 * AgentOrchestrator integration test (post-migration)
 *
 * Tests the new AgentOrchestrator from @centerseedwu/naru-agent combined with
 * our adapters: IntentResolverAdapter, DirectExecutorAdapter, PendingConfirmationExecutor.
 *
 * Replaced the old test that tested the custom AgentOrchestrator (now deleted).
 */

import { describe, expect, it, vi, beforeEach } from "vitest"

const mockBrainDumpExecute = vi.fn()
const mockQueryTodayExecute = vi.fn()
const mockCreateQueryTodayTasksTool = vi.fn()
const mockExtractBrainDumpConfirmationTarget = vi.fn()
const mockGetLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockClearLineSession = vi.fn()

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpTool: vi.fn(() => ({ execute: mockBrainDumpExecute })),
}))

vi.mock("@/application/use-cases/agent/query-tasks-skill", () => ({
  createQueryTodayTasksTool: mockCreateQueryTodayTasksTool,
  createQueryCompletedTodayTasksTool: vi.fn(() => ({ execute: vi.fn().mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n✅ 完成 0 項") })),
}))

vi.mock("@/application/use-cases/agent/query-calendar-skill", () => ({
  createQueryCalendarTool: vi.fn(() => ({ execute: vi.fn().mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📅 0 個行程") })),
}))

vi.mock("@/application/use-cases/agent/complete-task-skill", () => ({
  createCompleteTaskSearchTool: vi.fn(() => ({ execute: vi.fn().mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n0 個候選") })),
}))

vi.mock("@/application/use-cases/agent/adjust-tags-skill", () => ({
  createAdjustTagsTool: vi.fn(() => ({ execute: vi.fn().mockResolvedValue("調整預覽") })),
}))

vi.mock("@/application/use-cases/agent/planner-skill", () => ({
  createRunPlannerTool: vi.fn(() => ({ execute: vi.fn().mockResolvedValue("規劃完成") })),
}))

vi.mock("@/application/use-cases/agent/reorganize-skill", () => ({
  createReorganizeTool: vi.fn(() => ({ execute: vi.fn().mockResolvedValue("整理完成") })),
}))

vi.mock("@/application/use-cases/agent/complete-task-executor", () => ({
  executeCompleteTaskPayload: vi.fn(),
  buildCompleteTaskSuccessMessage: vi.fn((t: string) => `✅ 已完成「${t}」`),
}))

vi.mock("@/application/use-cases/agent/create-task-from-calendar-event", () => ({
  createTaskFromCalendarEvent: vi.fn(),
}))

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  saveLineSession: mockSaveLineSession,
  clearLineSession: mockClearLineSession,
}))

vi.mock("@/lib/line-confirmation", () => ({
  extractBrainDumpConfirmationTarget: mockExtractBrainDumpConfirmationTarget,
  classifyConfirmationDisposition: vi.fn(() => "override"),
}))

const { AgentOrchestrator } = await import("@centerseedwu/naru-agent")
const { DirectExecutorAdapter } = await import("@/application/use-cases/agent/direct-executor")
const { IntentResolverAdapter } = await import("@/application/use-cases/agent/agent-intent-resolver")

function makeDelegate(content = "delegate response") {
  return {
    chat: vi.fn().mockResolvedValue({
      blocked: false,
      content,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      intent: null,
      toolCalls: [],
      timings: {},
      sessionId: "sess-1",
      traceId: null,
      trace: null,
    }),
  }
}

function makeSessionStore() {
  return {
    get: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  }
}

function makeInnerIntentResolver(object: string, confidence = 0.9) {
  return {
    resolve: vi.fn().mockResolvedValue({
      intent: { object, requiresConfirmation: false, confidence },
      trace: {
        routeSource: "intent_resolver",
        resolver: "test",
        rawMessage: "",
        resolvedIntent: { object, requiresConfirmation: false, confidence },
        metadata: { temporalScope: "none", reasonCodes: ["test"] },
        selectedTool: null,
        targetQuery: null,
      },
    }),
  }
}

describe("AgentOrchestrator (new package) + DirectExecutorAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractBrainDumpConfirmationTarget.mockReturnValue(null)
    mockCreateQueryTodayTasksTool.mockReturnValue({ execute: mockQueryTodayExecute })
    mockQueryTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📋 目前查到 2 項")
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：測試任務")
    mockGetLineSession.mockResolvedValue(null)
  })

  describe("direct tool route via DirectExecutorAdapter", () => {
    it("should route today_focus intent through query_today_tasks", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const innerResolver = makeInnerIntentResolver("today_focus")
      const intentResolverAdapter = new IntentResolverAdapter(innerResolver as never)
      const directExecutorAdapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined,
        intentResolverAdapter,
      )

      const orchestrator = new AgentOrchestrator({
        delegate: delegate as never,
        intentResolver: intentResolverAdapter,
        directExecutors: [directExecutorAdapter as never],
      })

      const result = await orchestrator.chat("今天的代辦", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(mockQueryTodayExecute).toHaveBeenCalledWith({})
      expect(delegate.chat).not.toHaveBeenCalled()
      expect(result.toolCalls).toEqual(["query_today_tasks"])
      expect(result.content).toContain("目前查到 2 項")
    })

    it("should route brain_dump via task_capture with high confidence", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const innerResolver = makeInnerIntentResolver("task_capture", 0.95)
      const intentResolverAdapter = new IntentResolverAdapter(innerResolver as never)
      const directExecutorAdapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined,
        intentResolverAdapter,
      )

      const orchestrator = new AgentOrchestrator({
        delegate: delegate as never,
        intentResolver: intentResolverAdapter,
        directExecutors: [directExecutorAdapter as never],
      })

      const result = await orchestrator.chat("幫我記明天要開會", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(mockBrainDumpExecute).toHaveBeenCalledWith({})
      expect(delegate.chat).not.toHaveBeenCalled()
      expect(result.toolCalls).toEqual(["brain_dump"])
    })

    it("should return greeting without tool call", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const innerResolver = makeInnerIntentResolver("greeting")
      const intentResolverAdapter = new IntentResolverAdapter(innerResolver as never)
      const directExecutorAdapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined,
        intentResolverAdapter,
      )

      const orchestrator = new AgentOrchestrator({
        delegate: delegate as never,
        intentResolver: intentResolverAdapter,
        directExecutors: [directExecutorAdapter as never],
      })

      const result = await orchestrator.chat("你好", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(delegate.chat).not.toHaveBeenCalled()
      expect(result.toolCalls).toHaveLength(0)
      expect(result.content).toContain("Naru")
    })
  })

  describe("delegate route", () => {
    it("should delegate when intent is unknown", async () => {
      const delegate = makeDelegate("這是複雜回答")
      const sessionStore = makeSessionStore()
      const innerResolver = makeInnerIntentResolver("unknown", 0.1)
      const intentResolverAdapter = new IntentResolverAdapter(innerResolver as never)
      const directExecutorAdapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined,
        intentResolverAdapter,
      )

      const orchestrator = new AgentOrchestrator({
        delegate: delegate as never,
        intentResolver: intentResolverAdapter,
        directExecutors: [directExecutorAdapter as never],
      })

      const result = await orchestrator.chat("複雜的問題", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(delegate.chat).toHaveBeenCalled()
      expect(result.content).toBe("這是複雜回答")
    })
  })

  describe("OrchestrationResult fields", () => {
    it("should include orchestration trace fields in result", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const innerResolver = makeInnerIntentResolver("today_focus")
      const intentResolverAdapter = new IntentResolverAdapter(innerResolver as never)
      const directExecutorAdapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined,
        intentResolverAdapter,
      )

      const orchestrator = new AgentOrchestrator({
        delegate: delegate as never,
        intentResolver: intentResolverAdapter,
        directExecutors: [directExecutorAdapter as never],
      })

      const result = await orchestrator.chat("今天的代辦", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(result.decisionTrace).toBeDefined()
      expect(result.orchestrationIntent?.object).toBe("today_focus")
      expect(result.pendingConfirmation).toBeNull()
    })
  })
})
