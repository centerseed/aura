/**
 * TaskCompletionHandler — task_completion intent 處理邏輯
 *
 * 從 DirectExecutor 提取，獨立維護「完成任務」的執行流程。
 */

import type { ModelMessage } from "ai"
import { createCompleteTaskSearchTool } from "./complete-task-skill"
import { parseToolResult } from "./tool-result-protocol"
import { buildCompleteTaskSuccessMessage, executeCompleteTaskPayload } from "./complete-task-executor"
import {
  toCompleteTaskPayload,
  shouldClarifyAgainstRecentList,
  buildListClarificationMessage,
} from "./context-resolver"
import type { ContextResolver } from "./context-resolver"
import type { AgentIntent, AgentDecisionTrace } from "./agent-intent"
import type { AgentSessionState } from "./agent-session-state"
import type { DirectExecutorResult } from "./direct-executor"

export interface TaskCompletionInput {
  message: string
  intent: AgentIntent
  trace: AgentDecisionTrace
  history: ModelMessage[]
  sessionState: AgentSessionState
  userId: string
  confirmationKey: string | undefined
  contextResolver: ContextResolver
  savePendingState?: (sessionId: string, type: string, payload: unknown) => Promise<void>
}

export async function handleTaskCompletion(
  input: TaskCompletionInput,
): Promise<DirectExecutorResult | "delegate"> {
  const {
    message, intent, trace, history, sessionState, userId,
    confirmationKey, contextResolver, savePendingState,
  } = input

  const contextualEntity = contextResolver.resolveContextualEntity(message, sessionState, history)
  const contextualPayload = contextualEntity ? toCompleteTaskPayload(contextualEntity) : null
  const requireCompletionConfirmation = Boolean(
    confirmationKey
    && !contextualEntity
    && intent.object === "task_completion",
  )

  let toolName: string | null = null
  let toolOutput: string | null = null
  let toolHistoryContent: string | null = null

  if (contextualPayload) {
    toolName = "complete_task_search"
    if (requireCompletionConfirmation) {
      if (savePendingState && confirmationKey) {
        await savePendingState(confirmationKey, "complete_task_confirm", contextualPayload)
      }
      toolOutput = `你是要把「${contextualPayload.taskTitle}」標記為完成嗎？`
    } else {
      await executeCompleteTaskPayload(userId, contextualPayload)
      toolOutput = buildCompleteTaskSuccessMessage(contextualPayload.taskTitle)
    }
    toolHistoryContent = toolOutput
  }

  if (!toolOutput) {
    if (shouldClarifyAgainstRecentList(message, sessionState, history)) {
      return {
        content: buildListClarificationMessage(),
        toolName: null,
        toolOutput: null,
        toolHistoryContent: null,
        intent,
        trace,
      }
    }

    const resolvedQuery = contextualEntity?.title
      ?? contextResolver.resolveContextualQuery(message, sessionState, history)
    if (resolvedQuery) {
      toolName = "complete_task_search"
      toolOutput = await createCompleteTaskSearchTool(
        userId, message, confirmationKey, resolvedQuery, requireCompletionConfirmation,
      ).execute({})
      toolHistoryContent = toolOutput
    }

    if (!toolOutput) {
      toolName = "complete_task_search"
      toolOutput = await createCompleteTaskSearchTool(
        userId, message, confirmationKey, undefined, requireCompletionConfirmation,
      ).execute({})
      toolHistoryContent = toolOutput
    }
  }

  if (!toolName || !toolOutput) {
    return "delegate"
  }

  return {
    content: parseToolResult(toolOutput).summary,
    toolName,
    toolOutput,
    toolHistoryContent: toolHistoryContent ?? toolOutput,
    intent,
    trace,
  }
}
