import type {
  SessionMeta,
  SessionMetaStore,
} from "@/application/services/agent-session-lifecycle-service"

export class InMemoryAgentSessionMetaStore implements SessionMetaStore {
  private readonly store = new Map<string, SessionMeta>()

  async get(sessionId: string): Promise<SessionMeta | null> {
    const meta = this.store.get(sessionId)
    return meta ? { ...meta } : null
  }

  async save(sessionId: string, meta: SessionMeta): Promise<void> {
    this.store.set(sessionId, { ...meta })
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}
