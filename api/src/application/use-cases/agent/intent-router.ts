/**
 * IntentRouter — 意圖路由模組
 *
 * 職責：接收 ChannelMessage + 歷史，回傳 ResolvedIntent（含 ordinal 路由覆蓋）
 * 邏輯從 ToolFirstAgent 原封搬出，只是結構化成獨立模組。
 */

import type { ModelMessage } from "ai"
import {
  DeterministicAgentIntentResolver,
  type AgentIntentResolver,
  type ResolveAgentIntentResult,
} from "./agent-intent-resolver"
import type { AgentSessionState } from "./agent-session-state"

export type { ResolveAgentIntentResult }

// ── 序號引用模式（和 ToolFirstAgent 完全相同） ─────────────────────────────
const ORDINAL_REFERENCE_PATTERN = /第\s*([一二三四五六七八九十\d]+)\s*個/
const BARE_ORDINAL_PATTERN = /^\s*([一二三四五六七八九十\d]+)\s*$/
const LAST_ORDINAL_PATTERN = /最後一個|最後那個/
const ORDINAL_MAP: Record<string, number> = {
  "一": 0, "二": 1, "三": 2, "四": 3, "五": 4,
  "六": 5, "七": 6, "八": 7, "九": 8, "十": 9,
}

export function resolveOrdinalIndex(message: string): number | "last" | null {
  if (LAST_ORDINAL_PATTERN.test(message)) return "last"

  const match = message.match(ORDINAL_REFERENCE_PATTERN)
  const bareMatch = message.trim().match(BARE_ORDINAL_PATTERN)
  const ordinalToken = match?.[1] ?? bareMatch?.[1]
  if (!ordinalToken) return null

  const ordinal = ordinalToken
  const num = Number(ordinal)
  if (!Number.isNaN(num)) return num - 1

  const mapped = ORDINAL_MAP[ordinal]
  return mapped ?? null
}

export interface IntentRouterConfig {
  intentResolver?: AgentIntentResolver
}

export class IntentRouter {
  private readonly intentResolver: AgentIntentResolver

  constructor(config: IntentRouterConfig = {}) {
    this.intentResolver = config.intentResolver ?? new DeterministicAgentIntentResolver()
  }

  async resolve(input: {
    message: string
    history: ModelMessage[]
    sessionId: string | undefined
    userId: string | undefined
    sessionState: AgentSessionState
  }): Promise<ResolveAgentIntentResult> {
    const { message, history, sessionId, userId, sessionState } = input

    const result = await this.intentResolver.resolve({
      message,
      history,
      sessionId,
      userId,
    })

    // 如果 intent 是 unknown 但有序號 + 最近有 presented list，覆蓋為 task_completion
    const hasOrdinal = resolveOrdinalIndex(message) !== null
    const hasRecentList = sessionState.lastPresentedEntities.length > 0
    if (result.intent.object === "unknown" && hasOrdinal && hasRecentList) {
      return {
        intent: {
          ...result.intent,
          object: "task_completion" as const,
          requiresConfirmation: true,
          confidence: 0.9,
        },
        trace: result.trace,
      }
    }

    return result
  }
}
