import type { SessionMeta, SessionMetaStore } from "@/application/services/agent-session-lifecycle-service"
import type { PresentedEntity } from "./tool-result-protocol"

export interface AgentSessionState {
  lastPresentedEntities: PresentedEntity[]
  lastRecordedEntities: PresentedEntity[]
}

const EMPTY_AGENT_SESSION_STATE: AgentSessionState = {
  lastPresentedEntities: [],
  lastRecordedEntities: [],
}

function normalizeEntityList(raw: unknown): PresentedEntity[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const entity = item as Record<string, unknown>
      const title = typeof entity.title === "string" ? entity.title.trim() : ""
      if (!title) return null
      return {
        position: typeof entity.position === "number" ? entity.position : 0,
        title,
        entityId: typeof entity.entityId === "string" ? entity.entityId : undefined,
        entityType: typeof entity.entityType === "string" ? entity.entityType : undefined,
        taskId: typeof entity.taskId === "string" ? entity.taskId : undefined,
        subTaskId: typeof entity.subTaskId === "string" ? entity.subTaskId : undefined,
        planItemId: typeof entity.planItemId === "string" ? entity.planItemId : undefined,
        start: typeof entity.start === "string" ? entity.start : undefined,
        end: typeof entity.end === "string" ? entity.end : undefined,
        description: typeof entity.description === "string" ? entity.description : undefined,
        eventLink: typeof entity.eventLink === "string" ? entity.eventLink : undefined,
        meetLink: typeof entity.meetLink === "string" ? entity.meetLink : undefined,
        attendees: Array.isArray(entity.attendees)
          ? entity.attendees.filter((item): item is string => typeof item === "string")
          : undefined,
      }
    })
    .filter((item) => item !== null)
}

function normalizeState(meta: SessionMeta | null): AgentSessionState {
  const rawState = meta?.agentState
  if (!rawState || typeof rawState !== "object") return EMPTY_AGENT_SESSION_STATE
  const state = rawState as Record<string, unknown>

  return {
    lastPresentedEntities: normalizeEntityList(state.lastPresentedEntities),
    lastRecordedEntities: normalizeEntityList(state.lastRecordedEntities),
  }
}

export class AgentSessionStateStore {
  constructor(private readonly metaStore: SessionMetaStore) {}

  async get(sessionId: string): Promise<AgentSessionState> {
    const meta = await this.metaStore.get(sessionId)
    return normalizeState(meta)
  }

  async save(
    sessionId: string,
    updater: (current: AgentSessionState) => AgentSessionState,
  ): Promise<void> {
    const meta = await this.metaStore.get(sessionId)
    const current = normalizeState(meta)
    const next = updater(current)
    await this.metaStore.save(sessionId, {
      lastActivityAt: meta?.lastActivityAt ?? null,
      currentSegmentId: meta?.currentSegmentId ?? 1,
      lastFlushedSegmentId: meta?.lastFlushedSegmentId ?? null,
      lastFlushAt: meta?.lastFlushAt ?? null,
      agentState: next as unknown as Record<string, unknown>,
    })
  }
}
