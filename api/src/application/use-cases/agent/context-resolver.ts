/**
 * ContextResolver — 指代詞/序號解析模組
 *
 * 職責：將訊息中的指代詞（「剛才那個」「第二個」）解析為具體 entity
 * 邏輯從 ToolFirstAgent 原封搬出。
 */

import type { ModelMessage } from "ai"
import type { PresentedEntity } from "./tool-result-protocol"
import type { AgentSessionState } from "./agent-session-state"
import type { CompleteTaskPayload } from "@/lib/line-session"
import { resolveOrdinalIndex } from "./intent-router"
import {
  extractLatestPresentedEntities,
  extractLatestRecordedEntity,
  extractRecordedItems,
  extractTaskMentions,
} from "./history-extractor"

// Re-export history extraction utilities for consumers
export {
  extractLatestPresentedEntities,
  extractLatestRecordedEntity,
  extractRecordedItems,
  extractTaskMentions,
} from "./history-extractor"
export { extractLatestTaskCode } from "./history-extractor"

// ── 上下文引用模式 ─────────────────────────────────────────────────────────
export const CONTEXTUAL_REFERENCE_PATTERN = /(?:剛才|剛剛|上一個|上次|之前)(?:記的|那個|的)?|那個|這個/
export const CONTEXTUAL_ADJUST_REFERENCE_PATTERN = /(?:這個任務|那個任務|這件事|這個|那個|剛剛那個|剛才那個|上一個|上個)/
export const LIST_CONTEXTUAL_REFERENCE_PATTERN = /(?:第[一二三四五六七八九十\d]+個|最後一個|最後那個|那個|這個|剛剛那個|剛才那個|上一個|上個)/
export const BARE_COMPLETION_REFERENCE_PATTERN = /^(?:完成了?|做完了?|搞定了?|done|好了?|處理完了?|結束了?)$/i

export interface RecordedEntityReference {
  title: string
  sourceType?: CompleteTaskPayload["sourceType"]
  taskId?: string
  subTaskId?: string
  planItemId?: string
}

export function isRecordedEntityReference(
  value: PresentedEntity | RecordedEntityReference,
): value is RecordedEntityReference {
  return "sourceType" in value
}

export function isPresentedEntity(
  value: PresentedEntity | RecordedEntityReference,
): value is PresentedEntity {
  return "entityType" in value
}

export function toCompleteTaskPayload(
  entity: PresentedEntity | RecordedEntityReference,
): CompleteTaskPayload | null {
  const sourceType = isRecordedEntityReference(entity)
    ? entity.sourceType
    : entity.entityType

  if (sourceType !== "task" && sourceType !== "sub_task" && sourceType !== "daily_plan_item") {
    return null
  }

  const taskId = entity.taskId
  if (!taskId && sourceType !== "daily_plan_item") {
    return null
  }

  return {
    sourceType,
    taskTitle: entity.title,
    taskId,
    subTaskId: entity.subTaskId,
    planItemId: entity.planItemId,
  }
}

export function toTaskPresentedEntity(
  entity: PresentedEntity | RecordedEntityReference | null,
): PresentedEntity | null {
  if (!entity) return null

  if (isRecordedEntityReference(entity)) {
    if (entity.sourceType !== "task" || !entity.taskId) return null
    return {
      position: 1,
      title: entity.title,
      entityId: entity.taskId,
      entityType: "task",
      taskId: entity.taskId,
      subTaskId: entity.subTaskId,
      planItemId: entity.planItemId,
    }
  }

  if (entity.entityType !== "task" || !entity.taskId) return null
  return entity
}

export function hasRecentPresentedList(
  sessionState: AgentSessionState,
  history: ModelMessage[],
): boolean {
  if (sessionState.lastPresentedEntities.length > 0) return true
  return extractLatestPresentedEntities(history).length > 0
}

export function shouldClarifyAgainstRecentList(
  message: string,
  sessionState: AgentSessionState,
  history: ModelMessage[],
): boolean {
  if (!LIST_CONTEXTUAL_REFERENCE_PATTERN.test(message)) return false
  return hasRecentPresentedList(sessionState, history)
}

export function buildListClarificationMessage(): string {
  return "我知道你是在指剛剛那份清單，但還不能確定是哪一項。你是指清單中的哪一個？請直接回覆序號或完整名稱。"
}

export class ContextResolver {
  resolveContextualEntity(
    message: string,
    sessionState: AgentSessionState,
    history: ModelMessage[],
  ): PresentedEntity | RecordedEntityReference | null {
    const ordinalIndex = resolveOrdinalIndex(message)
    if (ordinalIndex !== null) {
      const presentedEntities = sessionState.lastPresentedEntities.length > 0
        ? sessionState.lastPresentedEntities
        : extractLatestPresentedEntities(history)
      if (ordinalIndex === "last") {
        return presentedEntities.at(-1) ?? null
      }
      if (ordinalIndex >= 0 && ordinalIndex < presentedEntities.length) {
        return presentedEntities[ordinalIndex] ?? null
      }
    }

    if (CONTEXTUAL_REFERENCE_PATTERN.test(message)) {
      if (sessionState.lastRecordedEntities.length > 0) {
        return sessionState.lastRecordedEntities.at(-1) ?? null
      }

      const latestRecordedEntity = extractLatestRecordedEntity(history)
      if (latestRecordedEntity) return latestRecordedEntity

      const presentedEntities = sessionState.lastPresentedEntities.length > 0
        ? sessionState.lastPresentedEntities
        : extractLatestPresentedEntities(history)
      if (presentedEntities.length > 0) {
        return presentedEntities.at(-1) ?? null
      }
    }

    if (BARE_COMPLETION_REFERENCE_PATTERN.test(message.trim())) {
      if (sessionState.lastRecordedEntities.length === 1) {
        return sessionState.lastRecordedEntities[0] ?? null
      }

      const latestRecordedEntity = extractLatestRecordedEntity(history)
      if (latestRecordedEntity) {
        return latestRecordedEntity
      }
    }

    return null
  }

  resolveContextualQuery(
    message: string,
    sessionState: AgentSessionState,
    history: ModelMessage[],
  ): string | null {
    const ordinalIndex = resolveOrdinalIndex(message)
    if (ordinalIndex !== null) {
      const mentions = sessionState.lastPresentedEntities.length > 0
        ? sessionState.lastPresentedEntities.map((entity) => entity.title)
        : extractTaskMentions(history)
      if (ordinalIndex === "last") {
        return mentions.at(-1) ?? null
      }
      if (ordinalIndex >= 0 && ordinalIndex < mentions.length) {
        return mentions[ordinalIndex] ?? null
      }
    }

    if (CONTEXTUAL_REFERENCE_PATTERN.test(message)) {
      const recordedItems = sessionState.lastRecordedEntities.length > 0
        ? sessionState.lastRecordedEntities.map((entity) => entity.title)
        : extractRecordedItems(history)
      if (recordedItems.length > 0) {
        return recordedItems.at(-1) ?? null
      }
      const mentions = extractTaskMentions(history)
      if (mentions.length > 0) {
        return mentions.at(-1) ?? null
      }
    }

    return null
  }
}
