import type { ModelMessage } from "ai"
import type { DecisionContext, LastListedItem, PendingConfirmationState } from "./agent-context"
import { EMPTY_DECISION_CONTEXT } from "./agent-context"

export interface AgentContextAssemblerInput {
  sessionId: string
  history: ModelMessage[]
  pendingConfirmation: PendingConfirmationState | null
}

export interface AgentContextAssembler {
  assemble(input: AgentContextAssemblerInput): Promise<DecisionContext>
}

function parseFactsBlock(raw: string): Record<string, unknown> | null {
  const startMarker = "[FACTS]"
  const endMarker = "[/FACTS]"
  const startIndex = raw.indexOf(startMarker)
  const endIndex = raw.indexOf(endMarker)
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null

  const jsonText = raw.slice(startIndex + startMarker.length, endIndex).trim()
  if (!jsonText) return null

  try {
    return JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractLastListedItems(history: ModelMessage[]): LastListedItem[] {
  const items: LastListedItem[] = []
  const seen = new Set<string>()

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant" || typeof message.content !== "string") continue

    const text = message.content
    const facts = parseFactsBlock(text) as {
      items?: Array<{ title?: string; id?: string; type?: string }>
      candidates?: Array<{ title?: string; id?: string; type?: string }>
      selectedTaskTitle?: string
    } | null

    if (facts?.selectedTaskTitle && typeof facts.selectedTaskTitle === "string") {
      const title = facts.selectedTaskTitle.trim()
      if (title && !seen.has(title)) {
        seen.add(title)
        items.push({ title, entityType: "task", position: items.length + 1 })
      }
    }

    if (Array.isArray(facts?.items)) {
      for (const item of facts.items) {
        if (item?.title && !seen.has(item.title)) {
          seen.add(item.title)
          items.push({
            title: item.title.trim(),
            entityId: item.id,
            entityType: item.type ?? "task",
            position: items.length + 1,
          })
        }
      }
    }

    if (Array.isArray(facts?.candidates)) {
      for (const candidate of facts.candidates) {
        if (candidate?.title && !seen.has(candidate.title)) {
          seen.add(candidate.title)
          items.push({
            title: candidate.title.trim(),
            entityId: candidate.id,
            entityType: candidate.type ?? "task",
            position: items.length + 1,
          })
        }
      }
    }

    // 從 numbered list 提取（e.g. "1. 晨跑 [健康]"）
    for (const match of text.matchAll(/(?:^|\n)\d+\.\s+(.+)/g)) {
      const raw = match[1]?.trim()
      if (!raw) continue
      const title = raw
        .replace(/\s+\[[^\]]+\].*$/, "")
        .replace(/\s+[📅📌].*$/, "")
        .trim()
      if (title && !seen.has(title)) {
        seen.add(title)
        items.push({ title, entityType: "task", position: items.length + 1 })
      }
    }

    // 找到第一個有項目的 assistant message 即停止
    if (items.length > 0) break
  }

  return items
}

/**
 * 從 session history 組合 DecisionContext。
 * v1：lastIntent 和 lastQueryFactIds 為 stub，後續補充。
 */
export class DeterministicAgentContextAssembler implements AgentContextAssembler {
  async assemble(input: AgentContextAssemblerInput): Promise<DecisionContext> {
    const { sessionId, history, pendingConfirmation } = input

    const lastListedItems = extractLastListedItems(history)

    return {
      ...EMPTY_DECISION_CONTEXT,
      sessionId,
      lastListedItems,
      pendingConfirmation,
      // v1 stubs — lastIntent & lastQueryFactIds 後續實作
      lastIntent: null,
      lastQueryFactIds: [],
      clarificationContext: null,
    }
  }
}
