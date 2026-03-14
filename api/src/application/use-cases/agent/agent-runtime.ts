import type { ModelMessage } from "ai"
import {
  InMemorySessionStore,
  InMemorySummaryStore,
  type MemoryManager,
} from "@centerseedwu/naru-agent"
import {
  AgentSessionLifecycleService,
  type CompressedSessionSummary,
  type LongTermMemoryMode,
} from "@/application/services/agent-session-lifecycle-service"
import { InMemoryAgentSessionMetaStore } from "@/infrastructure/stores/in-memory-agent-session-meta-store"
import { createMemoryManager } from "@/lib/naru-memory"

function normalizeMessageContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text
        }
        return JSON.stringify(part)
      })
      .join("\n")
  }
  return JSON.stringify(content)
}

function parseLongTermMemoryMode(rawValue: string | undefined): LongTermMemoryMode {
  switch (rawValue) {
    case undefined:
    case "":
    case "off":
      return "off"
    case "each_turn":
      return "each_turn"
    case "idle_flush_30m":
      return "idle_flush_30m"
    default:
      console.warn(`[agent-runtime] Unknown LONG_TERM_MEMORY_MODE=${rawValue}, fallback to off`)
      return "off"
  }
}

function buildFlushMessages(
  history: ModelMessage[],
  summary: CompressedSessionSummary | null,
): Array<{ role: string; content: string }> {
  const flushedMessages = history
    .map((message) => ({
      role: message.role,
      content: normalizeMessageContent(message.content),
    }))
    .filter((message) => message.content.trim() !== "")

  if (summary?.summaryText?.trim()) {
    flushedMessages.unshift({
      role: "assistant",
      content: `[COMPRESSED_SESSION_SUMMARY]\n${summary.summaryText}`,
    })
  }

  return flushedMessages
}

const longTermMemoryMode = parseLongTermMemoryMode(process.env.LONG_TERM_MEMORY_MODE)
const sessionStore = new InMemorySessionStore()
const summaryStore = new InMemorySummaryStore()
const metaStore = new InMemoryAgentSessionMetaStore()
const memoryManager: MemoryManager | null = longTermMemoryMode === "off" ? null : createMemoryManager()
const lifecycleService = new AgentSessionLifecycleService({
  sessionStore,
  summaryStore,
  metaStore,
  longTermMemoryMode,
  flushLongTermMemory: async ({ userId, history, summary }) => {
    if (!memoryManager) return
    const messages = buildFlushMessages(history, summary)
    if (messages.length === 0) return
    await memoryManager.add(userId, messages)
  },
})

export function getAgentRuntime() {
  return {
    longTermMemoryMode,
    sessionStore,
    summaryStore,
    metaStore,
    memoryManager,
    lifecycleService,
  }
}
