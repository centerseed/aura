import { describe, expect, it, vi } from "vitest"
import type { ModelMessage } from "ai"
import {
  AgentSessionLifecycleService,
  type CompressedSessionSummary,
  type SessionHistoryStore,
  type SessionMeta,
  type SessionMetaStore,
  type SessionSummaryStore,
} from "@/application/services/agent-session-lifecycle-service"

class MemorySessionStore implements SessionHistoryStore {
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

class MemorySummaryStore implements SessionSummaryStore {
  private readonly store = new Map<string, CompressedSessionSummary>()

  async get(sessionId: string): Promise<CompressedSessionSummary | null> {
    return this.store.get(sessionId) ?? null
  }

  async save(sessionId: string, summary: CompressedSessionSummary): Promise<void> {
    this.store.set(sessionId, summary)
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}

class MemoryMetaStore implements SessionMetaStore {
  private readonly store = new Map<string, SessionMeta>()

  async get(sessionId: string): Promise<SessionMeta | null> {
    return this.store.get(sessionId) ?? null
  }

  async save(sessionId: string, meta: SessionMeta): Promise<void> {
    this.store.set(sessionId, meta)
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}

function summary(text: string): CompressedSessionSummary {
  return {
    summaryText: text,
    compressedThroughRound: 3,
    createdAt: Date.now(),
    modelUsed: "test",
  }
}

function message(content: string): ModelMessage {
  return { role: "user", content }
}

describe("AgentSessionLifecycleService", () => {
  it("does not flush or reset when idle time is below 30 minutes", async () => {
    const sessionStore = new MemorySessionStore()
    const summaryStore = new MemorySummaryStore()
    const metaStore = new MemoryMetaStore()
    const flushLongTermMemory = vi.fn()
    const service = new AgentSessionLifecycleService({
      sessionStore,
      summaryStore,
      metaStore,
      longTermMemoryMode: "idle_flush_30m",
      flushLongTermMemory,
    })

    await sessionStore.save("session-1", [message("hello")])
    await summaryStore.save("session-1", summary("old summary"))
    await metaStore.save("session-1", {
      lastActivityAt: "2026-03-10T00:10:01.000Z",
      currentSegmentId: 1,
      lastFlushedSegmentId: null,
      lastFlushAt: null,
    })

    const result = await service.beforeMessage({
      sessionId: "session-1",
      userId: "user-1",
      now: new Date("2026-03-10T00:40:00.000Z"),
    })

    expect(result).toEqual({
      idleDetected: false,
      flushed: false,
      reset: false,
      flushFailed: false,
    })
    expect(flushLongTermMemory).not.toHaveBeenCalled()
    expect(await sessionStore.get("session-1")).toHaveLength(1)
    expect(await summaryStore.get("session-1")).not.toBeNull()
  })

  it("flushes and resets when session has been idle for 30 minutes", async () => {
    const sessionStore = new MemorySessionStore()
    const summaryStore = new MemorySummaryStore()
    const metaStore = new MemoryMetaStore()
    const flushLongTermMemory = vi.fn().mockResolvedValue(undefined)
    const service = new AgentSessionLifecycleService({
      sessionStore,
      summaryStore,
      metaStore,
      longTermMemoryMode: "idle_flush_30m",
      flushLongTermMemory,
    })

    await sessionStore.save("session-2", [message("first"), { role: "assistant", content: "reply" }])
    await summaryStore.save("session-2", summary("compressed"))
    await metaStore.save("session-2", {
      lastActivityAt: "2026-03-10T00:00:00.000Z",
      currentSegmentId: 7,
      lastFlushedSegmentId: 6,
      lastFlushAt: "2026-03-09T23:00:00.000Z",
    })

    const now = new Date("2026-03-10T00:30:00.000Z")
    const result = await service.beforeMessage({
      sessionId: "session-2",
      userId: "user-2",
      now,
    })

    expect(result).toEqual({
      idleDetected: true,
      flushed: true,
      reset: true,
      flushFailed: false,
    })
    expect(flushLongTermMemory).toHaveBeenCalledTimes(1)
    expect(flushLongTermMemory).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-2",
      userId: "user-2",
      segmentId: 7,
      summary: expect.objectContaining({ summaryText: "compressed" }),
    }))
    expect(await sessionStore.get("session-2")).toBeNull()
    expect(await summaryStore.get("session-2")).toBeNull()
    expect(await metaStore.get("session-2")).toEqual({
      lastActivityAt: now.toISOString(),
      currentSegmentId: 8,
      lastFlushedSegmentId: 7,
      lastFlushAt: now.toISOString(),
    })
  })

  it("does not block reply path or reset when flush fails", async () => {
    const sessionStore = new MemorySessionStore()
    const summaryStore = new MemorySummaryStore()
    const metaStore = new MemoryMetaStore()
    const flushLongTermMemory = vi.fn().mockRejectedValue(new Error("flush failed"))
    const service = new AgentSessionLifecycleService({
      sessionStore,
      summaryStore,
      metaStore,
      longTermMemoryMode: "idle_flush_30m",
      flushLongTermMemory,
      logger: { error: vi.fn(), warn: vi.fn() },
    })

    await sessionStore.save("session-3", [message("keep context")])
    await summaryStore.save("session-3", summary("keep summary"))
    await metaStore.save("session-3", {
      lastActivityAt: "2026-03-10T00:00:00.000Z",
      currentSegmentId: 2,
      lastFlushedSegmentId: 1,
      lastFlushAt: null,
    })

    const result = await service.beforeMessage({
      sessionId: "session-3",
      userId: "user-3",
      now: new Date("2026-03-10T00:45:00.000Z"),
    })

    expect(result).toEqual({
      idleDetected: true,
      flushed: false,
      reset: false,
      flushFailed: true,
    })
    expect(await sessionStore.get("session-3")).toHaveLength(1)
    expect(await summaryStore.get("session-3")).not.toBeNull()
    expect((await metaStore.get("session-3"))?.currentSegmentId).toBe(2)
  })

  it("flushes only once under concurrent beforeMessage calls", async () => {
    const sessionStore = new MemorySessionStore()
    const summaryStore = new MemorySummaryStore()
    const metaStore = new MemoryMetaStore()
    const releaseFlush = vi.fn<[], void>()
    let resolveFlush!: () => void
    const flushLongTermMemory = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveFlush = () => {
        releaseFlush()
        resolve()
      }
    }))
    const service = new AgentSessionLifecycleService({
      sessionStore,
      summaryStore,
      metaStore,
      longTermMemoryMode: "idle_flush_30m",
      flushLongTermMemory,
    })

    await sessionStore.save("session-4", [message("race")])
    await metaStore.save("session-4", {
      lastActivityAt: "2026-03-10T00:00:00.000Z",
      currentSegmentId: 4,
      lastFlushedSegmentId: 3,
      lastFlushAt: null,
    })

    const now = new Date("2026-03-10T00:30:00.000Z")
    const first = service.beforeMessage({ sessionId: "session-4", userId: "user-4", now })
    const second = service.beforeMessage({ sessionId: "session-4", userId: "user-4", now })

    await vi.waitFor(() => {
      expect(flushLongTermMemory).toHaveBeenCalledTimes(1)
    })
    resolveFlush()

    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(releaseFlush).toHaveBeenCalledTimes(1)
    expect(firstResult.flushed).toBe(true)
    expect(secondResult.flushed).toBe(false)
    expect(await sessionStore.get("session-4")).toBeNull()
    expect((await metaStore.get("session-4"))?.lastFlushedSegmentId).toBe(4)
  })

  it("does not trigger long-term memory flow when mode is off", async () => {
    const sessionStore = new MemorySessionStore()
    const summaryStore = new MemorySummaryStore()
    const metaStore = new MemoryMetaStore()
    const flushLongTermMemory = vi.fn()
    const service = new AgentSessionLifecycleService({
      sessionStore,
      summaryStore,
      metaStore,
      longTermMemoryMode: "off",
      flushLongTermMemory,
    })

    await sessionStore.save("session-5", [message("hello")])
    await metaStore.save("session-5", {
      lastActivityAt: "2026-03-10T00:00:00.000Z",
      currentSegmentId: 1,
      lastFlushedSegmentId: null,
      lastFlushAt: null,
    })

    const result = await service.beforeMessage({
      sessionId: "session-5",
      userId: "user-5",
      now: new Date("2026-03-10T01:00:00.000Z"),
    })

    expect(result).toEqual({
      idleDetected: true,
      flushed: false,
      reset: false,
      flushFailed: false,
    })
    expect(flushLongTermMemory).not.toHaveBeenCalled()
    expect(await sessionStore.get("session-5")).toHaveLength(1)
  })
})
