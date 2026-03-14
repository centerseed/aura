/**
 * PendingConfirmationExecutor — handles pending confirmation states as a BaseDirectExecutor
 *
 * This executor is configured as the FIRST entry in AgentOrchestrator.directExecutors.
 * It handles the three LINE confirmation types:
 *   - adjust_tags_preview
 *   - complete_task_confirm
 *   - brain_dump_pending
 *
 * The pending state is keyed by confirmationKey (LINE userId or api:{userId}),
 * managed via LinePendingStateManager. This executor runs in Phase 2 of the
 * new AgentOrchestrator, before the regular DirectExecutorAdapter.
 */

import type { BaseDirectExecutor, OrchestratorIntent, OrchestrationResult } from "@centerseedwu/naru-agent"
import type { ModelMessage } from "ai"
import type { LinePendingStateManager } from "./line-adapter"
import { classifyConfirmationDisposition } from "@/lib/line-confirmation"
import type { AdjustTagsPayload, BrainDumpPendingPayload, CompleteTaskPayload } from "@/lib/line-session"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { executeCompleteTaskPayload, buildCompleteTaskSuccessMessage } from "./complete-task-executor"
import { createBrainDumpTool } from "./brain-dump-skill"
import { parseToolResult } from "./tool-result-protocol"
import type { AgentIntentObject } from "./agent-intent"
import type { SessionHistoryStore } from "@/application/services/agent-session-lifecycle-service"

type ZeroUsage = OrchestrationResult["usage"]

const ZERO_USAGE: ZeroUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

function buildPendingResult(
  content: string,
  toolName?: string,
  toolOutput?: string,
): OrchestrationResult {
  return {
    blocked: false,
    content,
    usage: ZERO_USAGE,
    intent: null,
    toolCalls: toolName ? [toolName] : [],
    timings: {},
    sessionId: null,
    traceId: null,
    trace: null,
    decisionTrace: {
      traceId: "",
      phaseReached: "pending_confirmation",
      intentResolved: null,
      timings: { total: 0 },
      directExecutorUsed: "pending_confirmation",
      delegateUsed: null,
    },
    pendingConfirmation: null,
    orchestrationIntent: null,
  }
}

export class PendingConfirmationExecutor implements BaseDirectExecutor<AgentIntentObject> {
  readonly name = "pending_confirmation"

  constructor(
    private readonly pendingStateManager: LinePendingStateManager,
    private readonly sessionStore?: Pick<SessionHistoryStore, "get" | "save">,
  ) {}

  canHandle(_intent: OrchestratorIntent<AgentIntentObject>): boolean {
    // Always returns true — we check state in execute() and fall through if no pending
    return true
  }

  private async appendSessionHistory(
    sessionId: string,
    userMessage: string,
    assistantContent: string,
  ): Promise<void> {
    if (!this.sessionStore) return
    try {
      const history = await this.sessionStore.get(sessionId) ?? []
      const updated: ModelMessage[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantContent },
      ]
      await this.sessionStore.save(sessionId, updated)
    } catch (err) {
      // Non-fatal: session history write failure should not break the response
      console.warn("[PendingConfirmationExecutor] Failed to write session history:", err)
    }
  }

  async execute(input: {
    message: string
    intent: OrchestratorIntent<AgentIntentObject>
    options?: Record<string, unknown>
  }): Promise<OrchestrationResult | null> {
    const { message, options } = input
    const userId = typeof options?.userId === "string" ? options.userId : ""
    const sessionId = typeof options?.sessionId === "string" ? options.sessionId : "default"

    const pendingState = await this.pendingStateManager.getPending("")

    if (!pendingState) return null

    const disposition = classifyConfirmationDisposition(message)

    if (disposition === "reject") {
      await this.pendingStateManager.clearPending("")
      const result = buildPendingResult("好的，已取消。")
      await this.appendSessionHistory(sessionId, message, result.content)
      return result
    }

    if (disposition === "override") {
      await this.pendingStateManager.clearPending("")
      return null // continue to normal agent flow
    }

    // disposition === "confirm" → execute pending operation
    if (pendingState.type === "adjust_tags_preview") {
      const p = pendingState.payload as unknown as AdjustTagsPayload
      const executeUC = new ExecuteAdjustmentUseCase()
      const execResult = await executeUC.execute({
        userId,
        intentType: p.intentType,
        taskMatches: p.taskMatches,
        targetArea: p.targetArea,
        targetProduct: p.targetProduct,
        targetTopic: p.targetTopic,
        taskMap: p.taskMap as Parameters<typeof executeUC.execute>[0]["taskMap"],
        logId: p.logId,
      })
      await this.pendingStateManager.clearPending("")
      const summary = execResult.operationLog.join("\n")
      const content = `✅ 已完成分類調整：\n\n${summary}`
      const result = buildPendingResult(content, "adjust_tags_preview", content)
      await this.appendSessionHistory(sessionId, message, result.content)
      return result
    }

    if (pendingState.type === "complete_task_confirm") {
      const p = pendingState.payload as unknown as CompleteTaskPayload
      try {
        await executeCompleteTaskPayload(userId, p)
      } catch {
        await this.pendingStateManager.clearPending("")
        const errorResult = buildPendingResult("發生錯誤：無法識別要完成的任務。")
        await this.appendSessionHistory(sessionId, message, errorResult.content)
        return errorResult
      }
      await this.pendingStateManager.clearPending("")
      const successMessage = buildCompleteTaskSuccessMessage(p.taskTitle)
      const result = buildPendingResult(successMessage, "complete_task_search", successMessage)
      await this.appendSessionHistory(sessionId, message, result.content)
      return result
    }

    if (pendingState.type === "brain_dump_pending") {
      const p = pendingState.payload as unknown as BrainDumpPendingPayload
      const toolOutput = await createBrainDumpTool(userId, p.originalText).execute({})
      await this.pendingStateManager.clearPending("")
      const result = buildPendingResult(
        parseToolResult(toolOutput).summary,
        "brain_dump",
        toolOutput,
      )
      await this.appendSessionHistory(sessionId, message, result.content)
      return result
    }

    // Unknown pending type — clear and continue
    await this.pendingStateManager.clearPending("")
    return null
  }
}
