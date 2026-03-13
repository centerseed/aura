/**
 * AC8 + AC15: AgentOrchestrator 單元測試
 *
 * Verifies:
 * - Correct module calling order: resolve intent → try direct → delegate
 * - Direct execution route works
 * - Delegate route works
 * - Brain dump pending session is saved after delegate
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

const mockBrainDumpExecute = vi.fn()
const mockQueryTodayExecute = vi.fn()
const mockCreateQueryTodayTasksTool = vi.fn()
const mockExtractBrainDumpConfirmationTarget = vi.fn()
const mockSaveLineSession = vi.fn()
const mockGetLineSession = vi.fn()
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

const { AgentOrchestrator } = await import("@/application/use-cases/agent/agent-orchestrator")

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

function makeIntentResolver(object: string, confidence = 0.9) {
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

describe("AgentOrchestrator", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    mockExtractBrainDumpConfirmationTarget.mockReturnValue(null)
    mockCreateQueryTodayTasksTool.mockReturnValue({ execute: mockQueryTodayExecute })
    mockQueryTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📋 目前查到 2 項")
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：測試任務")
    mockGetLineSession.mockResolvedValue(null)
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe("direct tool route", () => {
    it("should route today_focus intent through query_today_tasks", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("today_focus"),
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
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("task_capture", 0.95),
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
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("greeting"),
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
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("unknown", 0.1),
      })

      const result = await orchestrator.chat("複雜的問題", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(delegate.chat).toHaveBeenCalled()
      expect(result.content).toBe("這是複雜回答")
    })

    it("should save brain dump pending session when delegate asks for confirmation", async () => {
      mockExtractBrainDumpConfirmationTarget.mockReturnValue("修復bug")
      const delegate = makeDelegate("你想要我記錄「修復bug」嗎？")
      const sessionStore = makeSessionStore()
      const mockPendingSave = vi.fn().mockResolvedValue(undefined)

      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("unknown", 0.1),
        confirmationKey: "line-uid-1",
        pendingStateProvider: {
          load: vi.fn().mockResolvedValue(null),
          save: mockPendingSave,
          clear: vi.fn().mockResolvedValue(undefined),
        },
      })

      const result = await orchestrator.chat("修復bug", {
        userId: "user-1",
        sessionId: "line-uid-1",
      })

      expect(mockPendingSave).toHaveBeenCalledWith("line-uid-1", "brain_dump_pending", {
        originalText: "修復bug",
        taskTitle: "修復bug",
      })
      expect(result.pendingConfirmation).toEqual({
        type: "brain_dump_pending",
        payload: { originalText: "修復bug", taskTitle: "修復bug" },
      })
    })
  })

  describe("short-circuit route", () => {
    it("should short-circuit single '記' character", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("unknown"),
      })

      const result = await orchestrator.chat("記", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(delegate.chat).not.toHaveBeenCalled()
      expect(result.content).toContain("請直接告訴我要記錄的內容")
      expect(result.toolCalls).toHaveLength(0)
    })
  })

  describe("session history persistence", () => {
    it("should persist history after direct tool route", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("today_focus"),
      })

      await orchestrator.chat("今天的代辦", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(sessionStore.save).toHaveBeenCalledWith(
        "sess-1",
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "今天的代辦" }),
          expect.objectContaining({ role: "assistant" }),
        ]),
      )
    })
  })

  describe("logging", () => {
    it("should log agent_orchestrator_chat_complete event", async () => {
      const delegate = makeDelegate()
      const sessionStore = makeSessionStore()
      const orchestrator = new AgentOrchestrator({
        delegate,
        sessionStore,
        intentResolver: makeIntentResolver("today_focus"),
      })

      await orchestrator.chat("今天的代辦", {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"agent_orchestrator_chat_complete"'),
      )
    })
  })
})
