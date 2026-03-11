import type { AgentIntent } from "./agent-intent"

export interface LastListedItem {
  title: string
  entityId?: string
  entityType: string
  position: number
}

export interface PendingConfirmationState {
  type: string
  taskTitle?: string
  taskId?: string
  subTaskId?: string
  planItemId?: string
}

export interface DecisionContext {
  lastIntent: AgentIntent | null
  lastListedItems: LastListedItem[]
  pendingConfirmation: PendingConfirmationState | null
  lastQueryFactIds: string[]
  clarificationContext: {
    object?: string
    message?: string
  } | null
  sessionId: string
}

export const EMPTY_DECISION_CONTEXT: DecisionContext = {
  lastIntent: null,
  lastListedItems: [],
  pendingConfirmation: null,
  lastQueryFactIds: [],
  clarificationContext: null,
  sessionId: "",
}
