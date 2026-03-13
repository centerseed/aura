/**
 * AC6: DirectExecutor 單元測試
 *
 * Verifies that DirectExecutor correctly routes high-confidence intents
 * to the appropriate tools and returns null for unknown/low-confidence intents.
 */

import { describe, expect, it, vi, beforeEach } from "vitest"

const mockBrainDumpExecute = vi.fn()
const mockQueryTodayExecute = vi.fn()
const mockCreateQueryTodayTasksTool = vi.fn()
const mockRunPlannerExecute = vi.fn()
const mockSaveLineSession = vi.fn()
const mockGetLineSession = vi.fn()
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
  createRunPlannerTool: vi.fn(() => ({ execute: mockRunPlannerExecute })),
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

const { DirectExecutor } = await import("@/application/use-cases/agent/direct-executor")

function makeTrace(temporalScope = "none") {
  return {
    routeSource: "intent_resolver" as const,
    resolver: "test",
    rawMessage: "",
    resolvedIntent: { object: "unknown" as const, requiresConfirmation: false, confidence: 0.1 },
    metadata: { temporalScope, reasonCodes: [] },
    selectedTool: null as string | null,
    targetQuery: null as string | null,
  }
}

function emptyState() {
  return { lastPresentedEntities: [], lastRecordedEntities: [] }
}

describe("DirectExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateQueryTodayTasksTool.mockReturnValue({ execute: mockQueryTodayExecute })
    mockQueryTodayExecute.mockResolvedValue("[FACTS]\n{}\n[/FACTS]\n\n📋 今天 2 個待辦")
    mockBrainDumpExecute.mockResolvedValue("✅ 已記錄 1 個項目：測試任務")
    mockRunPlannerExecute.mockResolvedValue("✅ 規劃完成！")
    mockSaveLineSession.mockResolvedValue(undefined)
  })

  describe("today_focus intent", () => {
    it("should execute query_today_tasks and return result", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "今天的代辦",
        intent: { object: "today_focus", requiresConfirmation: false, confidence: 0.9 },
        trace: makeTrace("today"),
        history: [],
        sessionState: emptyState(),
      })

      expect(result).not.toBeNull()
      expect(result?.toolName).toBe("query_today_tasks")
      expect(result?.toolOutput).toContain("今天 2 個待辦")
    })
  })

  describe("task_capture intent", () => {
    it("should execute brain_dump when confidence >= 0.95", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "幫我記一下明天要開會",
        intent: { object: "task_capture", requiresConfirmation: false, confidence: 0.95 },
        trace: makeTrace(),
        history: [],
        sessionState: emptyState(),
      })

      expect(result?.toolName).toBe("brain_dump")
      expect(mockBrainDumpExecute).toHaveBeenCalledWith({})
    })

    it("should return null when task_capture confidence < 0.95", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "記錄一下",
        intent: { object: "task_capture", requiresConfirmation: false, confidence: 0.8 },
        trace: makeTrace(),
        history: [],
        sessionState: emptyState(),
      })

      expect(result).toBeNull()
    })
  })

  describe("greeting intent", () => {
    it("should return greeting response without tool call", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "你好",
        intent: { object: "greeting", requiresConfirmation: false, confidence: 1.0 },
        trace: makeTrace(),
        history: [],
        sessionState: emptyState(),
      })

      expect(result?.toolName).toBeNull()
      expect(result?.toolOutput).toBeNull()
      expect(result?.content).toContain("Naru")
    })
  })

  describe("planning intent", () => {
    it("should execute run_planner tool", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "幫我規劃本月目標",
        intent: { object: "planning", requiresConfirmation: false, confidence: 0.9 },
        trace: makeTrace(),
        history: [],
        sessionState: emptyState(),
      })

      expect(result?.toolName).toBe("run_planner")
      expect(mockRunPlannerExecute).toHaveBeenCalledWith({})
    })
  })

  describe("unknown intent → delegate", () => {
    it("should return null for unknown intent so orchestrator delegates", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "嗯嗯",
        intent: { object: "unknown", requiresConfirmation: false, confidence: 0.1 },
        trace: makeTrace(),
        history: [],
        sessionState: emptyState(),
      })

      expect(result).toBeNull()
    })
  })

  describe("recall intents", () => {
    it("should return latest task code from history", async () => {
      const executor = new DirectExecutor({ userId: "user-1" })
      const result = await executor.tryExecute({
        message: "剛才說的任務代號是什麼",
        intent: { object: "recall_task_code", requiresConfirmation: false, confidence: 0.9 },
        trace: makeTrace(),
        history: [
          { role: "assistant", content: "已建立任務 ZNT-001234" },
        ],
        sessionState: emptyState(),
      })

      expect(result?.content).toBe("ZNT-001234")
      expect(result?.toolName).toBeNull()
    })
  })
})
