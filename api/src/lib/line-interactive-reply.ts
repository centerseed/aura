import type { LineSessionPayload, LineSessionType, CompleteTaskDisambiguationPayload } from "@/lib/line-session"
import { buildCompletionCandidateMessage, buildCompletionConfirmationMessage, buildPendingConfirmationMessage } from "@/lib/line-client"
import { extractBrainDumpConfirmationTarget } from "@/lib/line-confirmation"
import { extractPresentedEntities, parseToolResult } from "@/application/use-cases/agent/tool-result-protocol"

export type InteractiveReplyMessage =
  | { type: "text"; text: string }
  | ReturnType<typeof buildPendingConfirmationMessage>

export type LineInteractiveReply = {
  message: InteractiveReplyMessage
  sessionToSave?: {
    type: LineSessionType
    payload: LineSessionPayload
  }
}

export function buildLineInteractiveReply(
  rawContent: string,
  toolOutputs?: string[],
): LineInteractiveReply {
  const parsedSummary = parseToolResult(rawContent)
  const rawToolOutput = toolOutputs?.at(-1)
  const parsedToolOutput = rawToolOutput ? parseToolResult(rawToolOutput) : null
  const summary = parsedSummary.summary || rawContent.trim()
  const disambiguationPayload = extractCompletionDisambiguationPayload(parsedToolOutput?.facts ?? parsedSummary.facts)
  if (disambiguationPayload) {
    return {
      message: buildCompletionCandidateMessage(
        summary,
        disambiguationPayload.candidates.map((candidate) => ({
          position: candidate.position,
          label: `${candidate.position}. ${candidate.taskTitle}`,
        })),
      ),
      sessionToSave: {
        type: "complete_task_disambiguation",
        payload: disambiguationPayload,
      },
    }
  }

  const pendingBrainDumpTarget =
    extractBrainDumpConfirmationTarget(summary)
    ?? (parsedToolOutput ? extractBrainDumpConfirmationTarget(parsedToolOutput.summary) : null)
    ?? extractBrainDumpConfirmationTarget(rawContent)
  if (pendingBrainDumpTarget) {
    return {
      message: buildPendingConfirmationMessage(summary, "記錄", "取消"),
      sessionToSave: {
        type: "brain_dump_pending",
        payload: {
          originalText: pendingBrainDumpTarget,
          taskTitle: pendingBrainDumpTarget,
        },
      },
    }
  }

  if (looksLikeCompletionConfirmation(summary)) {
    return {
      message: buildCompletionConfirmationMessage(summary),
    }
  }

  if (looksLikePendingConfirmation(summary)) {
    return {
      message: buildPendingConfirmationMessage(summary),
    }
  }

  return {
    message: { type: "text", text: summary },
  }
}

function extractCompletionDisambiguationPayload(
  facts: Record<string, unknown> | null,
): CompleteTaskDisambiguationPayload | null {
  if (!facts || facts.decision !== "needs_disambiguation") {
    return null
  }

  const presentedEntities = extractPresentedEntities(facts)
  if (presentedEntities.length <= 1) {
    return null
  }

  const candidates = presentedEntities
    .map((entity) => {
      if (!entity.entityType || !entity.title) return null
      if (entity.entityType !== "task" && entity.entityType !== "sub_task" && entity.entityType !== "daily_plan_item") {
        return null
      }

      const sourceType = entity.entityType as "task" | "sub_task" | "daily_plan_item"

      return {
        position: entity.position,
        sourceType,
        taskTitle: entity.title,
        taskId: entity.taskId,
        subTaskId: entity.subTaskId,
        planItemId: entity.planItemId,
      }
    })
    .filter((candidate) => candidate !== null)

  if (candidates.length <= 1) {
    return null
  }

  return { candidates }
}

function looksLikePendingConfirmation(summary: string): boolean {
  return /回覆[「『"]?確認/u.test(summary) || /是否完成「.+」/u.test(summary)
}

function looksLikeCompletionConfirmation(summary: string): boolean {
  return /你是要把「.+」標記為完成嗎/u.test(summary)
    || /是否完成「.+」/u.test(summary)
}
