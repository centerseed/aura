/**
 * LINE Session Helper — 跨訊息保存暫存狀態
 *
 * 支援多步驟對話（adjust-tags confirm、complete-task confirm）
 */

import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

export type LineSessionType = "adjust_tags_preview" | "complete_task_confirm" | "brain_dump_pending"

export interface BrainDumpPendingPayload {
  originalText: string
  taskTitle?: string
}

export interface AdjustTagsPayload {
  logId: string
  intentType: "move_tasks" | "change_topic"
  taskMatches: Array<{
    task_id: string
    task_title: string
    current_location: string
    match_reason: string
  }>
  targetArea?: string
  targetProduct?: string
  targetTopic?: string
  taskMap: Record<string, unknown>
}

export interface CompleteTaskPayload {
  sourceType: "task" | "sub_task" | "daily_plan_item"
  taskTitle: string
  taskId?: string
  subTaskId?: string
  planItemId?: string
}

export type LineSessionPayload = AdjustTagsPayload | CompleteTaskPayload | BrainDumpPendingPayload

function isMissingLinePendingStateTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2021"
    && typeof error.meta?.table === "string"
    && error.meta.table.includes("line_pending_states")
}

export async function saveLineSession(
  lineUserId: string,
  type: LineSessionType,
  payload: LineSessionPayload,
  ttlMinutes = 10
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
  try {
    await prisma.linePendingState.upsert({
      where: { line_user_id: lineUserId },
      create: {
        id: randomUUID(),
        line_user_id: lineUserId,
        type,
        payload: payload as object,
        expires_at: expiresAt,
      },
      update: {
        type,
        payload: payload as object,
        expires_at: expiresAt,
      },
    })
  } catch (error) {
    if (isMissingLinePendingStateTable(error)) {
      console.warn("[line-session] line_pending_states table is missing; skip session persistence")
      return
    }
    throw error
  }
}

export async function getLineSession(
  lineUserId: string
): Promise<{ type: LineSessionType; payload: LineSessionPayload } | null> {
  let state
  try {
    state = await prisma.linePendingState.findUnique({
      where: { line_user_id: lineUserId },
    })
  } catch (error) {
    if (isMissingLinePendingStateTable(error)) {
      console.warn("[line-session] line_pending_states table is missing; treat session as empty")
      return null
    }
    throw error
  }
  if (!state) return null
  if (state.expires_at < new Date()) {
    await prisma.linePendingState.delete({ where: { line_user_id: lineUserId } }).catch(() => {})
    return null
  }
  // Validate session type before returning
  const validSessionTypes: LineSessionType[] = ["adjust_tags_preview", "complete_task_confirm", "brain_dump_pending"]
  if (!validSessionTypes.includes(state.type as LineSessionType)) {
    await clearLineSession(lineUserId).catch(() => {})
    return null
  }
  return {
    type: state.type as LineSessionType,
    payload: state.payload as unknown as LineSessionPayload,
  }
}

export async function clearLineSession(lineUserId: string): Promise<void> {
  await prisma.linePendingState.delete({ where: { line_user_id: lineUserId } }).catch((error) => {
    if (isMissingLinePendingStateTable(error)) return
  })
}
