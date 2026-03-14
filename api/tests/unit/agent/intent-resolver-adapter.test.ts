/**
 * AC6: IntentResolverAdapter unit tests
 *
 * Verifies:
 * - Bridges AgentIntentResolver → BaseIntentResolver<AgentIntentObject>
 * - Maps AgentIntent → OrchestratorIntent<AgentIntentObject>
 * - Preserves AgentDecisionTrace via getLastTrace()
 * - Result shape satisfies OrchestratorIntent contract
 */

import { describe, expect, it, vi } from "vitest"
import { IntentResolverAdapter } from "@/application/use-cases/agent/agent-intent-resolver"

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
    const inner = makeInnerResolver("today_focus", 0.95)
    const adapter = new IntentResolverAdapter(inner as never)

    const result = await adapter.resolve({ message: "今天的代辦" })

    expect(result.object).toBe("today_focus")
    expect(result.confidence).toBe(0.95)
    expect(result.requiresConfirmation).toBe(false)
  })

  it("should return requiresConfirmation when set in AgentIntent", async () => {
    const inner = makeInnerResolver("task_completion", 0.9, true)
    const adapter = new IntentResolverAdapter(inner as never)

    const result = await adapter.resolve({ message: "買牛奶完成了" })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.confidence).toBe(0.9)
  })

  it("should store AgentDecisionTrace via getLastTrace after resolve", async () => {
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
    const inner = makeInnerResolver("brain_dump_pending" as never, 0.8)
    const adapter = new IntentResolverAdapter(inner as never)

    const result = await adapter.resolve({ message: "記" })

    // OrchestratorIntent must have object, confidence; requiresConfirmation optional
    expect(typeof result.object).toBe("string")
    expect(typeof result.confidence).toBe("number")
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})
