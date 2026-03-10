import { describe, expect, it, vi } from "vitest"
import type { ModelMessage } from "ai"
import { AgentSessionLifecycleService } from "@/application/services/agent-session-lifecycle-service"
import { LifecycleAwareAgent } from "@/application/use-cases/agent/lifecycle-aware-agent"
import { InMemoryAgentSessionMetaStore } from "@/infrastructure/stores/in-memory-agent-session-meta-store"

class InMemorySessionStore {
  private readonly store = new Map<string, ModelMessage[]>()

  async get(sessionId: string): Promise<ModelMessage[] | null> {
    return this.store.get(sessionId) ?? null
  }

  async save(sessionId: string, history: ModelMessage[]): Promise<void> {
    this.store.set(sessionId, history)
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}

class InMemorySummaryStore {
  private readonly store = new Map<string, {
    summaryText: string
    compressedThroughRound: number
    createdAt: number
    modelUsed: string
  }>()

  async get(sessionId: string) {
    return this.store.get(sessionId) ?? null
  }

  async save(sessionId: string, summary: {
    summaryText: string
    compressedThroughRound: number
    createdAt: number
    modelUsed: string
  }) {
    this.store.set(sessionId, summary)
  }

  async delete(sessionId: string) {
    this.store.delete(sessionId)
  }
}

describe("LifecycleAwareAgent idle flush integration", () => {
  it("flushes the previous segment once, resets context, and still replies", async () => {
    const sessionStore = new InMemorySessionStore()
    const summaryStore = new InMemorySummaryStore()
    const metaStore = new InMemoryAgentSessionMetaStore()
    const flushLongTermMemory = vi.fn().mockResolvedValue(undefined)
    const lifecycleService = new AgentSessionLifecycleService({
      sessionStore,
      summaryStore,
      metaStore,
      longTermMemoryMode: "idle_flush_30m",
      flushLongTermMemory,
    })
    const innerAgent = {
      chat: vi.fn().mockResolvedValue({
        content: "new reply",
        toolCalls: [],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    }

    await sessionStore.save("line-user-1", [
      { role: "user", content: "old question" },
      { role: "assistant", content: "old answer" },
    ])
    await summaryStore.save("line-user-1", {
      summaryText: "old compressed context",
      compressedThroughRound: 2,
      createdAt: Date.now(),
      modelUsed: "test",
    })
    await metaStore.save("line-user-1", {
      lastActivityAt: "2026-03-10T00:00:00.000Z",
      currentSegmentId: 11,
      lastFlushedSegmentId: 10,
      lastFlushAt: null,
    })

    const nowValues = [
      new Date("2026-03-10T00:31:00.000Z"),
      new Date("2026-03-10T00:31:05.000Z"),
    ]
    const agent = new LifecycleAwareAgent(
      innerAgent,
      lifecycleService,
      "user-1",
      () => nowValues.shift() ?? new Date("2026-03-10T00:31:05.000Z"),
    )

    const result = await agent.chat("current message", {
      sessionId: "line-user-1",
      userId: "user-1",
    })

    expect(result.content).toBe("new reply")
    expect(flushLongTermMemory).toHaveBeenCalledTimes(1)
    expect(flushLongTermMemory).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "line-user-1",
      userId: "user-1",
      segmentId: 11,
    }))
    expect(innerAgent.chat).toHaveBeenCalledWith("current message", {
      sessionId: "line-user-1",
      userId: "user-1",
    })
    expect(await sessionStore.get("line-user-1")).toBeNull()
    expect(await summaryStore.get("line-user-1")).toBeNull()
    expect(await metaStore.get("line-user-1")).toEqual({
      lastActivityAt: "2026-03-10T00:31:05.000Z",
      currentSegmentId: 12,
      lastFlushedSegmentId: 11,
      lastFlushAt: "2026-03-10T00:31:00.000Z",
    })
  })
})
