/**
 * zentropy-agent afterMessageHook tests — AC4 / AC8
 *
 * BLOCK 4: Verifies that the afterMessageHook in createZentropyAgent correctly
 * detects brain dump confirmation prompts and saves brain_dump_pending state
 * via pendingStateManager.setPending.
 *
 * The hook is registered as lifecycleHooks.afterMessage in AgentOrchestrator.
 * It fires after every turn with the OrchestrationResult.
 */

import { describe, expect, it, vi, beforeEach } from "vitest"
import type { OrchestrationResult } from "@centerseedwu/naru-agent"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockClearLineSession = vi.fn()
const mockExtractBrainDumpConfirmationTarget = vi.fn()

// Capture the afterMessage hook when AgentOrchestrator is constructed
let capturedAfterMessageHook: ((result: OrchestrationResult) => Promise<void>) | undefined

class MockAgentOrchestrator {
  constructor(args: { lifecycleHooks?: { afterMessage?: (result: OrchestrationResult) => Promise<void> } }) {
    capturedAfterMessageHook = args.lifecycleHooks?.afterMessage
  }

  chat = vi.fn()
}

vi.mock("@centerseedwu/naru-agent", () => ({
  AgentOrchestrator: MockAgentOrchestrator,
  NaruAgent: vi.fn().mockImplementation(() => ({ chat: vi.fn() })),
  LLMStructuredClassifier: vi.fn().mockImplementation(() => ({})),
  InMemorySessionStore: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  })),
  InMemorySummaryStore: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  })),
  MemoryManager: vi.fn().mockImplementation(() => ({})),
}))

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpSkill: vi.fn().mockReturnValue({ name: "brain_dump", triggers: [] }),
  createBrainDumpTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/reorganize-skill", () => ({
  createReorganizeSkill: vi.fn().mockReturnValue({ name: "reorganize", triggers: [] }),
  createReorganizeTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/planner-skill", () => ({
  createPlannerSkill: vi.fn().mockReturnValue({ name: "planner", triggers: [] }),
  createRunPlannerTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/query-tasks-skill", () => ({
  createQueryTasksSkill: vi.fn().mockReturnValue({ name: "query_tasks", triggers: [] }),
  createQueryTodayTasksTool: vi.fn(() => ({ execute: vi.fn() })),
  createQueryCompletedTodayTasksTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/query-calendar-skill", () => ({
  createQueryCalendarSkill: vi.fn().mockReturnValue({ name: "query_calendar", triggers: [] }),
  createQueryCalendarTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/adjust-tags-skill", () => ({
  createAdjustTagsSkill: vi.fn().mockReturnValue({ name: "adjust_tags", triggers: [] }),
  createAdjustTagsTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/complete-task-skill", () => ({
  createCompleteTaskSkill: vi.fn().mockReturnValue({ name: "complete_task", triggers: [] }),
}))

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  saveLineSession: mockSaveLineSession,
  clearLineSession: mockClearLineSession,
}))

vi.mock("@/lib/agent-model", () => ({
  getAgentChatModel: vi.fn().mockReturnValue({}),
  getAgentSummaryModel: vi.fn().mockReturnValue({}),
}))

vi.mock("@/application/services/groq-prompt-guardrail", () => ({
  GroqPromptGuardrail: vi.fn(),
}))

vi.mock("@/application/use-cases/agent/agent-chat-turn-logger", () => ({
  AgentChatTurnLogger: vi.fn().mockImplementation(() => ({ log: vi.fn() })),
}))

vi.mock("@/application/use-cases/agent/agent-session-lifecycle-service", () => ({
  AgentSessionLifecycleService: vi.fn().mockImplementation(() => ({
    onTurnStart: vi.fn(),
    onTurnEnd: vi.fn(),
  })),
}))

vi.mock("@/application/use-cases/agent/lifecycle-aware-agent", () => ({
  LifecycleAwareAgent: vi.fn().mockImplementation((...args: unknown[]) => ({ _args: args })),
}))

vi.mock("@/lib/line-confirmation", () => ({
  extractBrainDumpConfirmationTarget: mockExtractBrainDumpConfirmationTarget,
  classifyConfirmationDisposition: vi.fn().mockReturnValue("override"),
}))

vi.mock("@/application/use-cases/agent/complete-task-executor", () => ({
  executeCompleteTaskPayload: vi.fn(),
  buildCompleteTaskSuccessMessage: vi.fn((t: string) => `✅ 已完成「${t}」`),
}))

vi.mock("@/application/use-cases/agent/create-task-from-calendar-event", () => ({
  createTaskFromCalendarEvent: vi.fn(),
}))

// ── Import under test ──────────────────────────────────────────────────────────

await import("@/application/use-cases/agent/zentropy-agent")
const { createZentropyAgent } = await import("@/application/use-cases/agent/zentropy-agent")

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDelegateResult(content: string): OrchestrationResult {
  return {
    blocked: false,
    content,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    intent: null,
    toolCalls: [],
    timings: {},
    sessionId: "sess-1",
    traceId: null,
    trace: null,
    decisionTrace: {
      traceId: "",
      phaseReached: "delegate",
      intentResolved: null,
      timings: { total: 100 },
      directExecutorUsed: null,
      delegateUsed: "naru",
    },
    pendingConfirmation: null,
    orchestrationIntent: null,
  }
}

function makeDirectResult(content: string): OrchestrationResult {
  return {
    ...makeDelegateResult(content),
    decisionTrace: {
      traceId: "",
      phaseReached: "direct_execution",
      intentResolved: null,
      timings: { total: 50 },
      directExecutorUsed: "zentropy_direct",
      delegateUsed: null,
    },
  }
}

describe("createZentropyAgent — afterMessageHook (AC4/AC8)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedAfterMessageHook = undefined
    mockGetLineSession.mockResolvedValue(null)
    mockExtractBrainDumpConfirmationTarget.mockReturnValue(null)
  })

  it("should register an afterMessage lifecycle hook", () => {
    createZentropyAgent("user-1", "line-uid-1")

    expect(capturedAfterMessageHook).toBeDefined()
    expect(typeof capturedAfterMessageHook).toBe("function")
  })

  describe("brain_dump_pending detection", () => {
    it("should call setPending with brain_dump_pending when delegate returns a brain dump confirmation prompt", async () => {
      mockExtractBrainDumpConfirmationTarget.mockReturnValue("今天要去跑步")

      createZentropyAgent("user-1", "line-uid-1")

      expect(capturedAfterMessageHook).toBeDefined()

      const result = makeDelegateResult("你想要我幫你記下「今天要去跑步」嗎？")
      await capturedAfterMessageHook!(result)

      // LinePendingStateManager.setPending calls saveLineSession
      expect(mockSaveLineSession).toHaveBeenCalledOnce()

      const [savedKey, savedType, savedPayload] = mockSaveLineSession.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ]

      // confirmationKey should be lineUserId for LINE calls
      expect(savedKey).toBe("line-uid-1")
      expect(savedType).toBe("brain_dump_pending")
      expect(savedPayload).toMatchObject({
        originalText: "今天要去跑步",
        taskTitle: "今天要去跑步",
      })
    })

    it("should use api:{userId} as confirmationKey for non-LINE calls", async () => {
      mockExtractBrainDumpConfirmationTarget.mockReturnValue("明天要開會")

      createZentropyAgent("user-api-123")

      const result = makeDelegateResult("你想要我幫你記下「明天要開會」嗎？")
      await capturedAfterMessageHook!(result)

      expect(mockSaveLineSession).toHaveBeenCalledOnce()
      const [savedKey] = mockSaveLineSession.mock.calls[0] as [string, ...unknown[]]
      expect(savedKey).toBe("api:user-api-123")
    })

    it("should NOT call setPending when delegate response does NOT match brain dump pattern", async () => {
      mockExtractBrainDumpConfirmationTarget.mockReturnValue(null)

      createZentropyAgent("user-1", "line-uid-1")

      const result = makeDelegateResult("今天有 3 個任務。")
      await capturedAfterMessageHook!(result)

      expect(mockSaveLineSession).not.toHaveBeenCalled()
    })

    it("should NOT call setPending when result is from direct_execution route (not delegate)", async () => {
      // The hook must guard on phaseReached === "delegate"
      mockExtractBrainDumpConfirmationTarget.mockReturnValue("今天要去跑步")

      createZentropyAgent("user-1", "line-uid-1")

      const result = makeDirectResult("今天有 2 項待辦")
      await capturedAfterMessageHook!(result)

      // direct_execution results should be ignored by the brain dump check
      expect(mockSaveLineSession).not.toHaveBeenCalled()
    })

    it("should NOT call setPending when result is from pending_confirmation route", async () => {
      mockExtractBrainDumpConfirmationTarget.mockReturnValue("今天要去跑步")

      createZentropyAgent("user-1", "line-uid-1")

      const result: OrchestrationResult = {
        ...makeDelegateResult("已完成。"),
        decisionTrace: {
          traceId: "",
          phaseReached: "pending_confirmation",
          intentResolved: null,
          timings: { total: 20 },
          directExecutorUsed: "pending_confirmation",
          delegateUsed: null,
        },
      }
      await capturedAfterMessageHook!(result)

      expect(mockSaveLineSession).not.toHaveBeenCalled()
    })
  })
})
