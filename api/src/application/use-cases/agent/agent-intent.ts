import { z } from "zod"

/** Intent objects the LLM classifier may return — used for the Zod schema. */
const LLM_AGENT_INTENT_OBJECT_VALUES = [
  "task_capture",
  "calendar_task_link",
  "task_completion",
  "today_focus",
  "completed_today",
  "calendar_query",
  "classification",
  "planning",
  "reorganize",
  "greeting",
  "recall_last_item",
  "recall_task_code",
  "unknown",
] as const

/**
 * Full intent object union — includes LLM values plus synthetic adapter-level
 * values that are never sent to the classifier.
 */
export const AGENT_INTENT_OBJECT_VALUES = [
  ...LLM_AGENT_INTENT_OBJECT_VALUES,
  "pending_confirmation",
  "short_record",
] as const

export type AgentIntentObject = (typeof AGENT_INTENT_OBJECT_VALUES)[number]

export interface AgentIntent {
  object: AgentIntentObject
  requiresConfirmation: boolean
  confidence: number
}

/** Schema passed to LLM classifier — excludes synthetic adapter-only values. */
export const AgentIntentSchema = z.object({
  object: z.enum(LLM_AGENT_INTENT_OBJECT_VALUES),
  requiresConfirmation: z.boolean(),
  confidence: z.number().min(0).max(1),
})

export interface AgentConversationState {
  lastIntent: AgentIntent | null
  lastResolvedEntities: Array<{ id?: string; title?: string; type?: string }>
  pendingConfirmation: {
    type: string
    entityId?: string
  } | null
  lastQueryFactIds: string[]
  clarificationContext: {
    object?: AgentIntentObject
    message?: string
  } | null
}

export interface AgentDecisionTrace {
  routeSource: "intent_resolver" | "delegate"
  resolver: string
  rawMessage: string
  resolvedIntent: AgentIntent
  metadata?: {
    speechAct?: "query" | "mutate" | "clarify" | "confirm" | "meta"
    targetReferenceMode?: "explicit" | "contextual" | "ambiguous" | "none"
    temporalScope?: "today" | "future" | "past" | "none"
    reasonCodes?: string[]
    classifierUsage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    classifierLatencyMs?: number
  }
  selectedTool: string | null
  targetQuery: string | null
}
