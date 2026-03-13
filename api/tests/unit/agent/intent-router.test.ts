/**
 * AC4: IntentRouter 單元測試
 *
 * Verifies that IntentRouter delegates to the AgentIntentResolver
 * and overrides unknown intents with ordinal+list context.
 */

import { describe, expect, it, vi } from "vitest"
import { IntentRouter } from "@/application/use-cases/agent/intent-router"
import type { AgentSessionState } from "@/application/use-cases/agent/agent-session-state"

function makeResolver(object: string, confidence = 0.9) {
  return {
    resolve: vi.fn().mockResolvedValue({
      intent: { object, requiresConfirmation: false, confidence },
      trace: {
        routeSource: "intent_resolver",
        resolver: "test",
        rawMessage: "",
        resolvedIntent: { object, requiresConfirmation: false, confidence },
        metadata: { reasonCodes: ["test"] },
        selectedTool: null,
        targetQuery: null,
      },
    }),
  }
}

function emptyState(): AgentSessionState {
  return { lastPresentedEntities: [], lastRecordedEntities: [] }
}

describe("IntentRouter", () => {
  it("should delegate to intentResolver and return its result", async () => {
    const resolver = makeResolver("today_focus")
    const router = new IntentRouter({ intentResolver: resolver })

    const result = await router.resolve({
      message: "今天的代辦",
      history: [],
      sessionId: "sess-1",
      userId: "user-1",
      sessionState: emptyState(),
    })

    expect(resolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ message: "今天的代辦" }),
    )
    expect(result.intent.object).toBe("today_focus")
    expect(result.intent.confidence).toBe(0.9)
  })

  it("should override unknown intent with task_completion when ordinal + recent list present", async () => {
    const resolver = makeResolver("unknown", 0.1)
    const router = new IntentRouter({ intentResolver: resolver })

    const state: AgentSessionState = {
      lastPresentedEntities: [
        { position: 1, title: "買牛奶", entityType: "task", taskId: "t1" },
        { position: 2, title: "健身", entityType: "task", taskId: "t2" },
      ],
      lastRecordedEntities: [],
    }

    const result = await router.resolve({
      message: "第一個",
      history: [],
      sessionId: "sess-1",
      userId: "user-1",
      sessionState: state,
    })

    expect(result.intent.object).toBe("task_completion")
    expect(result.intent.requiresConfirmation).toBe(true)
    expect(result.intent.confidence).toBe(0.9)
  })

  it("should NOT override when intent is known even if ordinal is present", async () => {
    const resolver = makeResolver("task_completion", 0.95)
    const router = new IntentRouter({ intentResolver: resolver })

    const state: AgentSessionState = {
      lastPresentedEntities: [
        { position: 1, title: "買牛奶", entityType: "task", taskId: "t1" },
      ],
      lastRecordedEntities: [],
    }

    const result = await router.resolve({
      message: "第一個完成了",
      history: [],
      sessionId: "sess-1",
      userId: "user-1",
      sessionState: state,
    })

    // Already a known intent — no override, keep original confidence
    expect(result.intent.object).toBe("task_completion")
    expect(result.intent.confidence).toBe(0.95)
  })

  it("should NOT override when unknown but no recent list", async () => {
    const resolver = makeResolver("unknown", 0.1)
    const router = new IntentRouter({ intentResolver: resolver })

    const result = await router.resolve({
      message: "第一個",
      history: [],
      sessionId: "sess-1",
      userId: "user-1",
      sessionState: emptyState(),
    })

    expect(result.intent.object).toBe("unknown")
  })

  it("should use DeterministicAgentIntentResolver by default", async () => {
    const router = new IntentRouter()
    const result = await router.resolve({
      message: "幫我整理任務",
      history: [],
      sessionId: "sess-1",
      userId: "user-1",
      sessionState: emptyState(),
    })

    // Deterministic resolver should recognize reorganize pattern
    expect(result.intent.object).toBe("reorganize")
    expect(result.intent.confidence).toBeGreaterThan(0.9)
  })
})
