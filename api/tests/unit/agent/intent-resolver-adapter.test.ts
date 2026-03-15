/**
 * AC6: IntentResolverAdapter unit tests
 *
 * Verifies:
 * - Bridges AgentIntentResolver → BaseIntentResolver<AgentIntentObject>
 * - Maps AgentIntent → OrchestratorIntent<AgentIntentObject>
 * - Preserves AgentDecisionTrace via getLastTrace()
 * - Result shape satisfies OrchestratorIntent contract
 * - FIX-2: Short-circuits to short_record for bare 記 messages
 * - FIX-4: Applies ordinal override when intent=unknown + ordinal + lastPresentedEntities
 */

import { describe, expect, it, vi } from "vitest"

const mockGetLineSession = vi.fn()
vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  saveLineSession: vi.fn(),
  clearLineSession: vi.fn(),
}))

const { IntentResolverAdapter } = await import("@/application/use-cases/agent/agent-intent-resolver")

function makeInnerResolver(object: string, confidence = 0.9, requiresConfirmation = false) {
  const trace = {
    routeSource: "intent_resolver" as const,
    resolver: "deterministic-v1",
    rawMessage: "test message",
    resolvedIntent: { object, requiresConfirmation, confidence },
    metadata: { reasonCodes: ["test"], temporalScope: "none" },
    selectedTool: null,
    targetQuery: null,
  }
  return {
    resolve: vi.fn().mockResolvedValue({
      intent: { object, requiresConfirmation, confidence },
      trace,
    }),
    _trace: trace,
  }
}

describe("IntentResolverAdapter", () => {
  it("should map AgentIntent object to OrchestratorIntent object", async () => {
    mockGetLineSession.mockResolvedValue(null)
    const inner = makeInnerResolver("today_focus", 0.95)
    const adapter = new IntentResolverAdapter(inner as never)

    const result = await adapter.resolve({ message: "今天的代辦" })

    expect(result.object).toBe("today_focus")
    expect(result.confidence).toBe(0.95)
    expect(result.requiresConfirmation).toBe(false)
  })

  it("should return requiresConfirmation when set in AgentIntent", async () => {
    mockGetLineSession.mockResolvedValue(null)
    const inner = makeInnerResolver("task_completion", 0.9, true)
    const adapter = new IntentResolverAdapter(inner as never)

    const result = await adapter.resolve({ message: "買牛奶完成了" })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.confidence).toBe(0.9)
  })

  it("should store AgentDecisionTrace via getLastTrace after resolve", async () => {
    mockGetLineSession.mockResolvedValue(null)
    const inner = makeInnerResolver("classification", 0.93)
    const adapter = new IntentResolverAdapter(inner as never)

    expect(adapter.getLastTrace()).toBeNull()

    await adapter.resolve({ message: "把任務移到另一個分類" })

    const trace = adapter.getLastTrace()
    expect(trace).not.toBeNull()
    expect(trace?.routeSource).toBe("intent_resolver")
    expect(trace?.resolvedIntent.object).toBe("classification")
    expect(trace?.resolver).toBe("deterministic-v1")
  })

  it("should satisfy BaseIntentResolver interface (returns OrchestratorIntent shape)", async () => {
    mockGetLineSession.mockResolvedValue(null)
    const inner = makeInnerResolver("brain_dump_pending" as never, 0.8)
    const adapter = new IntentResolverAdapter(inner as never)

    const result = await adapter.resolve({ message: "今天想做什麼" })

    // OrchestratorIntent must have object, confidence; requiresConfirmation optional
    expect(typeof result.object).toBe("string")
    expect(typeof result.confidence).toBe("number")
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  describe("FIX-2: 記 short-circuit", () => {
    it("should return short_record intent for bare 記 message", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("unknown", 0.1)
      const adapter = new IntentResolverAdapter(inner as never)

      const result = await adapter.resolve({ message: "記" })

      expect(result.object).toBe("short_record")
      expect(result.confidence).toBe(1.0)
      // Inner resolver must NOT be called
      expect(inner.resolve).not.toHaveBeenCalled()
    })

    it("should set lastTrace to short-record-fast-path for 記", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("unknown", 0.1)
      const adapter = new IntentResolverAdapter(inner as never)

      await adapter.resolve({ message: "記" })

      const trace = adapter.getLastTrace()
      expect(trace?.resolver).toBe("short-record-fast-path")
    })

    it("should NOT short-circuit for messages containing 記 but not exactly 記", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("task_capture", 0.96)
      const adapter = new IntentResolverAdapter(inner as never)

      const result = await adapter.resolve({ message: "幫我記一下今天要開會" })

      expect(result.object).toBe("task_capture")
      expect(inner.resolve).toHaveBeenCalledOnce()
    })
  })

  describe("FIX-4: ordinal override to task_completion", () => {
    // Helper: wrap domain AgentSessionState in metadata (matches orchestrator behaviour)
    function wrapSessionState(domainState: {
      lastPresentedEntities: Array<{ position: number; title: string }>
      lastRecordedEntities: Array<{ position: number; title: string }>
    }) {
      return {
        sessionId: "test",
        lastPresentedEntities: domainState.lastPresentedEntities,
        metadata: domainState,
        updatedAt: Date.now(),
      }
    }

    it("should override unknown intent to task_completion when ordinal + lastPresentedEntities", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("unknown", 0.1)
      const adapter = new IntentResolverAdapter(inner as never)

      const sessionState = wrapSessionState({
        lastPresentedEntities: [{ position: 1, title: "買牛奶" }],
        lastRecordedEntities: [],
      })
      const result = await adapter.resolve({ message: "1", sessionState })

      expect(result.object).toBe("task_completion")
      expect(result.confidence).toBe(0.9)
      expect(result.requiresConfirmation).toBe(true)
    })

    it("should override unknown intent to task_completion for Chinese ordinal", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("unknown", 0.1)
      const adapter = new IntentResolverAdapter(inner as never)

      const sessionState = wrapSessionState({
        lastPresentedEntities: [{ position: 1, title: "買牛奶" }, { position: 2, title: "運動" }],
        lastRecordedEntities: [],
      })
      const result = await adapter.resolve({ message: "第一個", sessionState })

      expect(result.object).toBe("task_completion")
      expect(result.requiresConfirmation).toBe(true)
    })

    it("should NOT override when no lastPresentedEntities", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("unknown", 0.1)
      const adapter = new IntentResolverAdapter(inner as never)

      const sessionState = wrapSessionState({
        lastPresentedEntities: [],
        lastRecordedEntities: [],
      })
      const result = await adapter.resolve({ message: "1", sessionState })

      expect(result.object).toBe("unknown")
    })

    it("should NOT override when intent is not unknown", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("today_focus", 0.95)
      const adapter = new IntentResolverAdapter(inner as never)

      const sessionState = wrapSessionState({
        lastPresentedEntities: [{ position: 1, title: "買牛奶" }],
        lastRecordedEntities: [],
      })
      const result = await adapter.resolve({ message: "1", sessionState })

      // Not overriding since inner resolved to today_focus (not unknown)
      expect(result.object).toBe("today_focus")
    })

    it("should set ordinal_override_task_completion reason code in trace", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const inner = makeInnerResolver("unknown", 0.1)
      const adapter = new IntentResolverAdapter(inner as never)

      const sessionState = wrapSessionState({
        lastPresentedEntities: [{ position: 1, title: "買牛奶" }],
        lastRecordedEntities: [],
      })
      await adapter.resolve({ message: "2", sessionState })

      const trace = adapter.getLastTrace()
      expect(trace?.metadata?.reasonCodes).toContain("ordinal_override_task_completion")
    })
  })
})
