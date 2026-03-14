/**
 * DirectExecutorAdapter session persistence tests — AC8
 *
 * BLOCK 2: Verifies that session history is saved after direct route execution.
 * BLOCK 3: Verifies that AgentSessionState (lastPresentedEntities /
 *           lastRecordedEntities) is updated after direct route execution.
 *
 * These are regression tests: the old AgentOrchestrator called
 * appendSessionHistory and persistCanonicalSessionState after every direct
 * execution. The new package's AgentOrchestrator only does this on the
 * delegate route. DirectExecutorAdapter must fill this gap.
 */

import { describe, expect, it, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQueryTodayExecute = vi.fn()
const mockCreateQueryTodayTasksTool = vi.fn()
const mockBrainDumpExecute = vi.fn()
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

// ── Import under test ──────────────────────────────────────────────────────────

const { DirectExecutorAdapter } = await import("@/application/use-cases/agent/direct-executor")

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSessionStore(existingHistory = []) {
  return {
    get: vi.fn().mockResolvedValue(existingHistory),
    save: vi.fn().mockResolvedValue(undefined),
  }
}

function makeSessionStateStore(existingState = { lastPresentedEntities: [], lastRecordedEntities: [] }) {
  return {
    get: vi.fn().mockResolvedValue(existingState),
    save: vi.fn().mockResolvedValue(undefined),
  }
}

function makeIntent(object: string, confidence = 0.95) {
  return { object: object as never, confidence, requiresConfirmation: false }
}

const TODAY_FACTS_WITH_ENTITIES = JSON.stringify({
  presentedEntities: [
    { position: 1, title: "買咖啡", taskId: "task-001", entityType: "task" },
    { position: 2, title: "開週會", taskId: "task-002", entityType: "task" },
  ],
})

const BRAIN_DUMP_FACTS_WITH_RECORDED = JSON.stringify({
  recordedItems: [
    { position: 1, title: "明天開會記得帶筆記", taskId: "task-new-001", sourceType: "task" },
  ],
})

describe("DirectExecutorAdapter — session persistence (AC8)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLineSession.mockResolvedValue(null)
    mockCreateQueryTodayTasksTool.mockReturnValue({ execute: mockQueryTodayExecute })
    mockQueryTodayExecute.mockResolvedValue(
      `[FACTS]\n${TODAY_FACTS_WITH_ENTITIES}\n[/FACTS]\n\n📋 今天有 2 項`,
    )
    mockBrainDumpExecute.mockResolvedValue(
      `[FACTS]\n${BRAIN_DUMP_FACTS_WITH_RECORDED}\n[/FACTS]\n\n✅ 已記錄 1 個項目`,
    )
  })

  // ── BLOCK 2: Session History Persistence ────────────────────────────────────

  describe("BLOCK 2 — session history is saved after direct execution", () => {
    it("should call sessionStore.save with user message and assistant response after today_focus", async () => {
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
      expect(sessionStore.save).toHaveBeenCalledOnce()

      const savedHistory = sessionStore.save.mock.calls[0][1] as Array<{ role: string; content: string }>
      const userMsg = savedHistory.find((m) => m.role === "user")
      const assistantMsg = savedHistory.find((m) => m.role === "assistant")

      expect(userMsg?.content).toBe("今天的代辦")
      expect(assistantMsg?.content).toContain("今天有 2 項")
    })

    it("should append to existing history (not overwrite)", async () => {
      const existingHistory = [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！" },
      ]
      const sessionStore = makeSessionStore(existingHistory as never)
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
      )

      await adapter.execute({
        message: "今天的代辦",
        intent: makeIntent("today_focus"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      const savedHistory = sessionStore.save.mock.calls[0][1] as Array<{ role: string; content: string }>

      // Should contain original 2 messages + 2 new ones
      expect(savedHistory.length).toBe(4)
      expect(savedHistory[0].content).toBe("你好")
      expect(savedHistory[1].content).toBe("你好！")
      expect(savedHistory[2].role).toBe("user")
      expect(savedHistory[2].content).toBe("今天的代辦")
      expect(savedHistory[3].role).toBe("assistant")
    })

    it("should NOT call sessionStore.save when execute returns null (delegate route)", async () => {
      const sessionStore = makeSessionStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
      )

      const result = await adapter.execute({
        message: "複雜問題",
        intent: makeIntent("unknown", 0.1),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(result).toBeNull()
      expect(sessionStore.save).not.toHaveBeenCalled()
    })

    it("should save session history for task_capture (brain_dump) direct route", async () => {
      const sessionStore = makeSessionStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
      )

      await adapter.execute({
        message: "幫我記明天要開會",
        intent: makeIntent("task_capture", 0.95),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(sessionStore.save).toHaveBeenCalledOnce()
      const savedHistory = sessionStore.save.mock.calls[0][1] as Array<{ role: string; content: string }>
      const userMsg = savedHistory.find((m) => m.role === "user")
      expect(userMsg?.content).toBe("幫我記明天要開會")
    })
  })

  // ── BLOCK 3: AgentSessionState Update ───────────────────────────────────────

  describe("BLOCK 3 — AgentSessionState is updated after direct execution", () => {
    it("should call sessionStateStore.save with presentedEntities after today_focus", async () => {
      const sessionStore = makeSessionStore()
      const sessionStateStore = makeSessionStateStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        sessionStateStore,
      )

      const result = await adapter.execute({
        message: "今天的代辦",
        intent: makeIntent("today_focus"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(result).not.toBeNull()
      expect(sessionStateStore.save).toHaveBeenCalledOnce()

      // The save call receives (sessionId, updater)
      const [savedSessionId, updater] = sessionStateStore.save.mock.calls[0] as [
        string,
        (current: { lastPresentedEntities: unknown[]; lastRecordedEntities: unknown[] }) => unknown,
      ]

      expect(savedSessionId).toBe("sess-1")

      // Apply the updater to get the new state
      const newState = updater({ lastPresentedEntities: [], lastRecordedEntities: [] }) as {
        lastPresentedEntities: Array<{ title: string }>
        lastRecordedEntities: unknown[]
      }

      expect(newState.lastPresentedEntities).toHaveLength(2)
      expect(newState.lastPresentedEntities[0].title).toBe("買咖啡")
      expect(newState.lastPresentedEntities[1].title).toBe("開週會")
    })

    it("should call sessionStateStore.save with recordedEntities after task_capture", async () => {
      const sessionStore = makeSessionStore()
      const sessionStateStore = makeSessionStateStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        sessionStateStore,
      )

      await adapter.execute({
        message: "幫我記明天要開會",
        intent: makeIntent("task_capture", 0.95),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(sessionStateStore.save).toHaveBeenCalledOnce()

      const [, updater] = sessionStateStore.save.mock.calls[0] as [
        string,
        (current: { lastPresentedEntities: unknown[]; lastRecordedEntities: unknown[] }) => unknown,
      ]

      const newState = updater({ lastPresentedEntities: [], lastRecordedEntities: [] }) as {
        lastPresentedEntities: unknown[]
        lastRecordedEntities: Array<{ title: string }>
      }

      expect(newState.lastRecordedEntities).toHaveLength(1)
      expect(newState.lastRecordedEntities[0].title).toBe("明天開會記得帶筆記")
    })

    it("should NOT call sessionStateStore.save when tool output has no facts", async () => {
      // greeting intent — no tool call, no facts
      const sessionStore = makeSessionStore()
      const sessionStateStore = makeSessionStateStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        sessionStateStore,
      )

      await adapter.execute({
        message: "你好",
        intent: makeIntent("greeting"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      expect(sessionStateStore.save).not.toHaveBeenCalled()
    })

    it("should NOT call sessionStateStore.save when no sessionStateStore is provided", async () => {
      // Regression: adapter should not crash when sessionStateStore is undefined
      const sessionStore = makeSessionStore()
      const adapter = new DirectExecutorAdapter(
        { userId: "user-1", confirmationKey: "line-uid-1" },
        sessionStore,
        undefined, // no sessionStateStore
      )

      const result = await adapter.execute({
        message: "今天的代辦",
        intent: makeIntent("today_focus"),
        options: { sessionId: "sess-1", userId: "user-1" },
      })

      // Should succeed and return a result without crashing
      expect(result).not.toBeNull()
    })
  })
})
