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
import type { LinePendingStateManager } from "./line-adapter"
import { classifyConfirmationDisposition } from "@/lib/line-confirmation"
import type { AdjustTagsPayload, BrainDumpPendingPayload, CompleteTaskPayload } from "@/lib/line-session"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { executeCompleteTaskPayload, buildCompleteTaskSuccessMessage } from "./complete-task-executor"
import { createBrainDumpTool } from "./brain-dump-skill"
import { parseToolResult } from "./tool-result-protocol"
import type { AgentIntentObject } from "./agent-intent"

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

  constructor(private readonly pendingStateManager: LinePendingStateManager) {}

  canHandle(_intent: OrchestratorIntent<AgentIntentObject>): boolean {
    // Always returns true — we check state in execute() and fall through if no pending
    return true
  }

  async execute(input: {
    message: string
    intent: OrchestratorIntent<AgentIntentObject>
    options?: Record<string, unknown>
  }): Promise<OrchestrationResult | null> {
    const { message, options } = input
    const userId = typeof options?.userId === "string" ? options.userId : ""

    const pendingState = await this.pendingStateManager.getPending("")

    if (!pendingState) return null

    const disposition = classifyConfirmationDisposition(message)

    if (disposition === "reject") {
      await this.pendingStateManager.clearPending("")
      return buildPendingResult("好的，已取消。")
    }

    if (disposition === "override") {
      await this.pendingStateManager.clearPending("")
      return null // continue to normal agent flow
    }

    // disposition === "confirm" → execute pending operation
    if (pendingState.type === "adjust_tags_preview") {
      const p = pendingState.payload as unknown as AdjustTagsPayload
      const executeUC = new ExecuteAdjustmentUseCase()
      const result = await executeUC.execute({
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
      const summary = result.operationLog.join("\n")
      const content = `✅ 已完成分類調整：\n\n${summary}`
      return buildPendingResult(content, "adjust_tags_preview", content)
    }

    if (pendingState.type === "complete_task_confirm") {
      const p = pendingState.payload as unknown as CompleteTaskPayload
      try {
        await executeCompleteTaskPayload(userId, p)
      } catch {
        await this.pendingStateManager.clearPending("")
        return buildPendingResult("發生錯誤：無法識別要完成的任務。")
      }
      await this.pendingStateManager.clearPending("")
      const successMessage = buildCompleteTaskSuccessMessage(p.taskTitle)
      return buildPendingResult(successMessage, "complete_task_search", successMessage)
    }

    if (pendingState.type === "brain_dump_pending") {
      const p = pendingState.payload as unknown as BrainDumpPendingPayload
      const toolOutput = await createBrainDumpTool(userId, p.originalText).execute({})
      await this.pendingStateManager.clearPending("")
      return buildPendingResult(
        parseToolResult(toolOutput).summary,
        "brain_dump",
        toolOutput,
      )
    }

    // Unknown pending type — clear and continue
    await this.pendingStateManager.clearPending("")
    return null
  }
}
