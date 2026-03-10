import type { ModelMessage } from "ai"

export type LongTermMemoryMode = "off" | "each_turn" | "idle_flush_30m"

export interface CompressedSessionSummary {
  summaryText: string
  compressedThroughRound: number
  createdAt: number
  modelUsed: string
}

export interface SessionHistoryStore {
  get(sessionId: string): Promise<ModelMessage[] | null>
  save(sessionId: string, history: ModelMessage[]): Promise<void>
  delete(sessionId: string): Promise<void>
}

export interface SessionSummaryStore {
  get(sessionId: string): Promise<CompressedSessionSummary | null>
  save(sessionId: string, summary: CompressedSessionSummary): Promise<void>
  delete(sessionId: string): Promise<void>
}

export interface SessionMeta {
  lastActivityAt: string | null
  currentSegmentId: number
  lastFlushedSegmentId: number | null
  lastFlushAt: string | null
}

export interface SessionMetaStore {
  get(sessionId: string): Promise<SessionMeta | null>
  save(sessionId: string, meta: SessionMeta): Promise<void>
  delete(sessionId: string): Promise<void>
}

export interface FlushLongTermMemoryInput {
  sessionId: string
  userId: string
  history: ModelMessage[]
  summary: CompressedSessionSummary | null
  segmentId: number
  triggeredAt: Date
}

interface BeforeMessageInput {
  sessionId: string
  userId: string
  now: Date
}

interface AfterMessageInput {
  sessionId: string
  now: Date
}

interface AgentSessionLifecycleServiceConfig {
  sessionStore: SessionHistoryStore
  summaryStore: SessionSummaryStore
  metaStore: SessionMetaStore
  longTermMemoryMode: LongTermMemoryMode
  flushLongTermMemory: (input: FlushLongTermMemoryInput) => Promise<void>
  idleTimeoutMs?: number
  logger?: Pick<Console, "error" | "warn">
}

export interface BeforeMessageResult {
  idleDetected: boolean
  flushed: boolean
  reset: boolean
  flushFailed: boolean
}

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000

function defaultMeta(meta?: SessionMeta | null): SessionMeta {
  return {
    lastActivityAt: meta?.lastActivityAt ?? null,
    currentSegmentId: meta?.currentSegmentId ?? 1,
    lastFlushedSegmentId: meta?.lastFlushedSegmentId ?? null,
    lastFlushAt: meta?.lastFlushAt ?? null,
  }
}

function hasSnapshot(history: ModelMessage[], summary: CompressedSessionSummary | null): boolean {
  return history.length > 0 || Boolean(summary?.summaryText?.trim())
}

class KeyedMutex {
  private chains = new Map<string, Promise<void>>()

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    this.chains.set(key, previous.then(() => current))

    await previous

    try {
      return await task()
    } finally {
      release()
      if (this.chains.get(key) === current) {
        this.chains.delete(key)
      }
    }
  }
}

export class AgentSessionLifecycleService {
  private readonly mutex = new KeyedMutex()
  private readonly idleTimeoutMs: number
  private readonly logger: Pick<Console, "error" | "warn">

  constructor(private readonly config: AgentSessionLifecycleServiceConfig) {
    this.idleTimeoutMs = config.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.logger = config.logger ?? console
  }

  async beforeMessage(input: BeforeMessageInput): Promise<BeforeMessageResult> {
    return this.mutex.runExclusive(input.sessionId, async () => {
      const meta = defaultMeta(await this.config.metaStore.get(input.sessionId))
      const idleDetected = this.isIdle(meta.lastActivityAt, input.now)

      if (this.config.longTermMemoryMode !== "idle_flush_30m" || !idleDetected) {
        await this.config.metaStore.save(input.sessionId, meta)
        return {
          idleDetected,
          flushed: false,
          reset: false,
          flushFailed: false,
        }
      }

      const history = (await this.config.sessionStore.get(input.sessionId)) ?? []
      const summary = await this.config.summaryStore.get(input.sessionId)

      if (!hasSnapshot(history, summary) || meta.lastFlushedSegmentId === meta.currentSegmentId) {
        await this.config.metaStore.save(input.sessionId, {
          ...meta,
          lastActivityAt: input.now.toISOString(),
        })
        return {
          idleDetected,
          flushed: false,
          reset: false,
          flushFailed: false,
        }
      }

      try {
        await this.config.flushLongTermMemory({
          sessionId: input.sessionId,
          userId: input.userId,
          history,
          summary,
          segmentId: meta.currentSegmentId,
          triggeredAt: input.now,
        })
      } catch (error) {
        this.logger.error("[agent-lifecycle] idle flush failed", {
          sessionId: input.sessionId,
          userId: input.userId,
          segmentId: meta.currentSegmentId,
          error,
        })
        return {
          idleDetected,
          flushed: false,
          reset: false,
          flushFailed: true,
        }
      }

      await Promise.all([
        this.config.sessionStore.delete(input.sessionId),
        this.config.summaryStore.delete(input.sessionId),
      ])

      await this.config.metaStore.save(input.sessionId, {
        ...meta,
        currentSegmentId: meta.currentSegmentId + 1,
        lastFlushedSegmentId: meta.currentSegmentId,
        lastFlushAt: input.now.toISOString(),
        lastActivityAt: input.now.toISOString(),
      })

      return {
        idleDetected,
        flushed: true,
        reset: true,
        flushFailed: false,
      }
    })
  }

  async afterMessage(input: AfterMessageInput): Promise<void> {
    await this.mutex.runExclusive(input.sessionId, async () => {
      const meta = defaultMeta(await this.config.metaStore.get(input.sessionId))
      await this.config.metaStore.save(input.sessionId, {
        ...meta,
        lastActivityAt: input.now.toISOString(),
      })
    })
  }

  private isIdle(lastActivityAt: string | null, now: Date): boolean {
    if (!lastActivityAt) return false
    const lastActivityMs = new Date(lastActivityAt).getTime()
    if (Number.isNaN(lastActivityMs)) {
      this.logger.warn("[agent-lifecycle] invalid lastActivityAt", { lastActivityAt })
      return false
    }
    return now.getTime() - lastActivityMs >= this.idleTimeoutMs
  }
}
