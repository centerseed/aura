import { describe, expect, it, vi } from "vitest"

const mockNaruAgent = vi.fn()
vi.mock("@centerseedwu/naru-agent", () => ({
  NaruAgent: mockNaruAgent,
  LLMStructuredClassifier: vi.fn(),
}))

const { createDecisionFallbackAgent, createResponseAgent, createMemoryAwareAssistant } =
  await import("@/application/use-cases/agent/agent-factories")

function buildRuntime(overrides: Record<string, unknown> = {}) {
  return {
    sessionStore: { get: vi.fn(), save: vi.fn() },
    summaryStore: { get: vi.fn(), save: vi.fn() },
    memoryManager: null,
    longTermMemoryMode: "off",
    chatModel: { model: "test-model" } as unknown as ReturnType<typeof import("@/lib/agent-model").getAgentChatModel>,
    summaryModel: { model: "test-summary-model" } as unknown as ReturnType<typeof import("@/lib/agent-model").getAgentSummaryModel>,
    guardrails: undefined,
    ...overrides,
  }
}

describe("createDecisionFallbackAgent", () => {
  it("creates a NaruAgent without skills", () => {
    const runtime = buildRuntime()
    createDecisionFallbackAgent(runtime)

    expect(mockNaruAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "naru-decision",
      }),
    )

    const config = mockNaruAgent.mock.calls.at(-1)?.[0]
    expect(config?.skills).toBeUndefined()
  })

  it("each call creates a new instance", () => {
    const runtime = buildRuntime()
    mockNaruAgent.mockClear()

    createDecisionFallbackAgent(runtime)
    createDecisionFallbackAgent(runtime)

    expect(mockNaruAgent).toHaveBeenCalledTimes(2)
  })

  it("does not pass memoryManager when longTermMemoryMode is off", () => {
    const runtime = buildRuntime({ longTermMemoryMode: "off" })
    createDecisionFallbackAgent(runtime)

    const config = mockNaruAgent.mock.calls.at(-1)?.[0]
    expect(config?.memoryManager).toBeUndefined()
  })

  it("passes memoryManager when longTermMemoryMode is each_turn", () => {
    const fakeMemory = { add: vi.fn() }
    const runtime = buildRuntime({
      longTermMemoryMode: "each_turn",
      memoryManager: fakeMemory,
    })
    createDecisionFallbackAgent(runtime)

    const config = mockNaruAgent.mock.calls.at(-1)?.[0]
    expect(config?.memoryManager).toBe(fakeMemory)
  })
})

describe("createResponseAgent", () => {
  it("creates a NaruAgent with correct skills", () => {
    const runtime = buildRuntime()
    const skills = [{ name: "brain_dump" }, { name: "query_tasks" }] as unknown as Parameters<typeof createResponseAgent>[1]
    createResponseAgent(runtime, skills)

    const config = mockNaruAgent.mock.calls.at(-1)?.[0]
    expect(config?.skills).toBe(skills)
    expect(config?.name).toBe("naru")
  })

  it("each call creates a new instance", () => {
    const runtime = buildRuntime()
    mockNaruAgent.mockClear()

    createResponseAgent(runtime, [])
    createResponseAgent(runtime, [])

    expect(mockNaruAgent).toHaveBeenCalledTimes(2)
  })
})

describe("createMemoryAwareAssistant", () => {
  it("creates a NaruAgent with memory-aware name", () => {
    const runtime = buildRuntime()
    createMemoryAwareAssistant(runtime)

    const config = mockNaruAgent.mock.calls.at(-1)?.[0]
    expect(config?.name).toBe("naru-memory")
  })

  it("always passes memoryManager regardless of longTermMemoryMode", () => {
    const fakeMemory = { add: vi.fn() }
    const runtime = buildRuntime({ memoryManager: fakeMemory, longTermMemoryMode: "off" })
    createMemoryAwareAssistant(runtime)

    const config = mockNaruAgent.mock.calls.at(-1)?.[0]
    expect(config?.memoryManager).toBe(fakeMemory)
  })
})
