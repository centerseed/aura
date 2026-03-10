import { z } from "zod"

export const AGENT_SPEECH_ACT_VALUES = ["query", "mutate", "clarify", "confirm", "meta"] as const
export const AGENT_INTENT_OBJECT_VALUES = [
  "task_capture",
  "task_completion",
  "today_focus",
  "completed_today",
  "classification",
  "planning",
  "reorganize",
  "greeting",
  "recall_last_item",
  "recall_task_code",
  "unknown",
] as const
export const AGENT_TARGET_REFERENCE_MODE_VALUES = ["explicit", "contextual", "ambiguous", "none"] as const
export const AGENT_TEMPORAL_SCOPE_VALUES = ["today", "future", "past", "none"] as const

export type AgentSpeechAct = (typeof AGENT_SPEECH_ACT_VALUES)[number]
export type AgentIntentObject = (typeof AGENT_INTENT_OBJECT_VALUES)[number]
export type AgentTargetReferenceMode = (typeof AGENT_TARGET_REFERENCE_MODE_VALUES)[number]
export type AgentTemporalScope = (typeof AGENT_TEMPORAL_SCOPE_VALUES)[number]

export interface AgentIntent {
  speechAct: AgentSpeechAct
  object: AgentIntentObject
  targetReferenceMode: AgentTargetReferenceMode
  temporalScope: AgentTemporalScope
  requiresConfirmation: boolean
  confidence: number
  reasonCodes: string[]
}

export const AgentIntentSchema = z.object({
  speechAct: z.enum(AGENT_SPEECH_ACT_VALUES),
  object: z.enum(AGENT_INTENT_OBJECT_VALUES),
  targetReferenceMode: z.enum(AGENT_TARGET_REFERENCE_MODE_VALUES),
  temporalScope: z.enum(AGENT_TEMPORAL_SCOPE_VALUES),
  requiresConfirmation: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasonCodes: z.array(z.string()),
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
  selectedTool: string | null
  targetQuery: string | null
}
