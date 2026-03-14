/**
 * AC3: DirectExecutorAdapter unit tests
 *
 * Verifies:
 * - canHandle returns true for known intent types, false for unknown
 * - execute delegates to DirectExecutor and returns OrchestrationResult
 * - execute returns null when DirectExecutor returns null (low confidence)
 * - result contains correct toolCalls, content, decisionTrace fields
 * - trace field carries AgentDecisionTrace for LifecycleAwareAgent compatibility
 */

import { describe, expect, it, vi, beforeEach } from "vitest"

const mockBrainDumpExecute = vi.fn()
const mockQueryTodayExecute = vi.fn()
const mockCreateQueryTodayTasksTool = vi.fn()
const mockGetLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockClearLineSession = vi.fn()

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpTool: vi.fn(() => ({ execute: mockBrainDumpExecute })),
}))

vi.mock("@/application/use-cases/agent/query-tasks-skill", () => ({
  createQueryTodayTasksTool: mockCreateQueryTodayTasksTool,
  createQueryCompletedTodayTasksTool: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n✅ 今天完成 0 項"),
  })),
}))

vi.mock("@/application/use-cases/agent/query-calendar-skill", () => ({
  createQueryCalendarTool: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📅 0 個行程"),
  })),
}))

vi.mock("@/application/use-cases/agent/complete-task-skill", () => ({
  createCompleteTaskSearchTool: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n0 個候選"),
  })),
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
  executeCompleteTaskPayload: vi.fn().mockResolvedValue(undefined),
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

const { DirectExecutorAdapter } = await import("@/application/use-cases/agent/direct-executor")

function makeSessionStore() {
  return {
    get: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  }
}

function makeIntent(object: string, confidence = 0.95) {
  return { object: object as never, confidence, requiresConfirmation: false }
}

describe("DirectExecutorAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateQueryTodayTasksTool.mockReturnValue({ execute: mockQueryTodayExecute })
    mockQueryTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📋 目前查到 2 項")
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：測試任務")
    mockGetLineSession.mockResolvedValue(null)
  })

  describe("canHandle", () => {
    it("should return true for known high-confidence intent types", () => {
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        makeSessionStore(),
      )

      expect(adapter.canHandle(makeIntent("today_focus"))).toBe(true)
      expect(adapter.canHandle(makeIntent("task_capture"))).toBe(true)
      expect(adapter.canHandle(makeIntent("greeting"))).toBe(true)
      expect(adapter.canHandle(makeIntent("classification"))).toBe(true)
      expect(adapter.canHandle(makeIntent("planning"))).toBe(true)
    })

    it("should return false for unknown intent", () => {
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        makeSessionStore(),
      )

      expect(adapter.canHandle(makeIntent("unknown"))).toBe(false)
    })
  })

  describe("execute", () => {
    it("should execute today_focus and return OrchestrationResult with toolCalls", async () => {
      const sessionStore = makeSessionStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
      )

      const result = await adapter.execute({
        message: "今天的代辦",
        intent: makeIntent("today_focus"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(result).not.toBeNull()
      expect(result?.toolCalls).toEqual(["query_today_tasks"])
      expect(result?.content).toContain("目前查到 2 項")
      expect(result?.blocked).toBe(false)
    })

    it("should return null for unknown intent (falls through to delegate)", async () => {
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        makeSessionStore(),
      )

      const result = await adapter.execute({
        message: "複雜問題",
        intent: makeIntent("unknown", 0.1),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(result).toBeNull()
    })

    it("should include decisionTrace in OrchestrationResult", async () => {
      const sessionStore = makeSessionStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
      )

      const result = await adapter.execute({
        message: "今天的代辦",
        intent: makeIntent("today_focus"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(result?.decisionTrace).toBeDefined()
      expect(result?.decisionTrace.phaseReached).toBe("direct_execution")
      expect(result?.decisionTrace.directExecutorUsed).toBe("zentropy_direct")
    })

    it("should carry AgentDecisionTrace in result.trace for LifecycleAwareAgent compatibility", async () => {
      const sessionStore = makeSessionStore()
      const mockIntentResolverAdapter = {
        getLastTrace: vi.fn().mockReturnValue({
          routeSource: "intent_resolver",
          resolver: "deterministic-v1",
          rawMessage: "今天的代辦",
          resolvedIntent: { object: "today_focus", requiresConfirmation: false, confidence: 0.95 },
          metadata: { reasonCodes: ["test"] },
          selectedTool: null,
          targetQuery: null,
        }),
      }
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined,
        mockIntentResolverAdapter,
      )

      const result = await adapter.execute({
        message: "今天的代辦",
        intent: makeIntent("today_focus"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      // trace field carries AgentDecisionTrace (duck typing for LifecycleAwareAgent)
      const trace = result?.trace as Record<string, unknown> | null
      expect(trace).not.toBeNull()
      expect(trace?.resolvedIntent).toBeDefined()
      expect((trace?.resolvedIntent as { object?: string })?.object).toBe("today_focus")
    })
  })
})
