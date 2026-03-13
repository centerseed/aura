/**
 * HistoryExtractor — 從對話歷史中擷取實體與記錄項目
 *
 * 從 context-resolver.ts 提取的純函式，職責是掃描 ModelMessage[] 歷史，
 * 回傳任務代號、已記錄項目、已呈現實體等結構化資料。
 */

import type { ModelMessage } from "ai"
import {
  extractPresentedEntities,
  parseToolResult,
  type PresentedEntity,
} from "./tool-result-protocol"
import type { CompleteTaskPayload } from "@/lib/line-session"

export interface RecordedEntityRef {
  title: string
  sourceType?: CompleteTaskPayload["sourceType"]
  taskId?: string
  subTaskId?: string
  planItemId?: string
}

function parseFactsBlock(raw: string): unknown | null {
  return parseToolResult(raw).facts
}

export function extractLatestPresentedEntities(history: ModelMessage[]): PresentedEntity[] {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message?.role !== "assistant" || typeof message.content !== "string") continue
    const facts = parseFactsBlock(message.content) as Record<string, unknown> | null
    const presentedEntities = extractPresentedEntities(facts)
    if (presentedEntities.length > 0) {
      return presentedEntities.sort((lhs, rhs) => lhs.position - rhs.position)
    }
  }
  return []
}

export function extractLatestRecordedEntity(history: ModelMessage[]): RecordedEntityRef | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message?.role !== "assistant" || typeof message.content !== "string") continue

    const facts = parseFactsBlock(message.content) as {
      recordedItems?: Array<{
        title?: string
        sourceType?: CompleteTaskPayload["sourceType"]
        taskId?: string
        subTaskId?: string
        planItemId?: string
      }>
    } | null

    if (!Array.isArray(facts?.recordedItems) || facts.recordedItems.length === 0) continue

    const latest = facts.recordedItems[facts.recordedItems.length - 1]
    const title = latest?.title?.trim()
    if (!title) continue

    return {
      title,
      sourceType: latest.sourceType,
      taskId: latest.taskId,
      subTaskId: latest.subTaskId,
      planItemId: latest.planItemId,
    }
  }

  return null
}

export function extractRecordedItems(history: ModelMessage[]): string[] {
  const items: string[] = []

  for (const message of history) {
    if (message.role !== "assistant" || typeof message.content !== "string") continue
    const text = message.content
    const facts = parseFactsBlock(text) as {
      recordedItems?: Array<{ title?: string }>
    } | null

    if (Array.isArray(facts?.recordedItems)) {
      for (const item of facts.recordedItems) {
        const title = item?.title?.trim()
        if (title) items.push(title)
      }
      continue
    }

    for (const match of text.matchAll(/已記錄[^：]*：.*?「([^」]+)」/g)) {
      if (match[1]) items.push(match[1].trim())
    }

    if (!text.includes("「")) {
      const plainMatch = text.match(/已記錄\s+\d+\s+個項目：(.+)/)
      if (plainMatch?.[1]) {
        for (const title of plainMatch[1].split("、")) {
          const cleaned = title.trim()
          if (cleaned) items.push(cleaned)
        }
      }
    }
  }

  return items
}

function extractMentionsFromSingleMessage(text: string): string[] {
  const numberedItems: string[] = []

  const facts = parseFactsBlock(text) as {
    items?: Array<{ title?: string }>
    candidates?: Array<{ title?: string }>
    selectedTaskTitle?: string
  } | null

  const presentedEntities = extractPresentedEntities(facts)
  if (presentedEntities.length > 0) {
    return presentedEntities
      .sort((lhs, rhs) => lhs.position - rhs.position)
      .map((entity) => entity.title)
  }

  for (const match of text.matchAll(/(?:^|\n)\d+\.\s+(.+)/g)) {
    const raw = match[1]?.trim()
    if (!raw) continue
    const title = raw
      .replace(/\s+\[[^\]]+\].*$/, "")
      .replace(/\s+[📅📌].*$/, "")
      .trim()
    if (title) numberedItems.push(title)
  }

  if (numberedItems.length > 0) {
    return numberedItems
  }

  if (Array.isArray(facts?.items) && facts.items.length > 0) {
    return facts.items
      .map((item) => item?.title?.trim())
      .filter((title): title is string => Boolean(title))
  }

  return []
}

export function extractTaskMentions(history: ModelMessage[]): string[] {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant" || typeof message.content !== "string") continue
    const items = extractMentionsFromSingleMessage(message.content)
    if (items.length > 0) return items
  }
  return []
}

export function extractLatestTaskCode(history: ModelMessage[]): string | null {
  const taskCodePattern = /\b[A-Z]+-\d{6}\b/g

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (typeof message.content !== "string") continue
    const matches = message.content.match(taskCodePattern)
    if (matches && matches.length > 0) {
      return matches[matches.length - 1] ?? null
    }
  }

  return null
}
