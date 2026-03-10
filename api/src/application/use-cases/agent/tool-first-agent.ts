import type { ModelMessage } from "ai"
import type { MemoryManager } from "naru-agent-js"
import type { ChatOptions } from "naru-agent-js"
import { createBrainDumpTool } from "./brain-dump-skill"
import { createAdjustTagsTool } from "./adjust-tags-skill"
import { createCompleteTaskSearchTool } from "./complete-task-skill"
import { createReorganizeTool } from "./reorganize-skill"
import { createQueryCompletedTodayTasksTool, createQueryTodayTasksTool } from "./query-tasks-skill"
import {
  DeterministicAgentIntentResolver,
  type AgentIntentResolver,
} from "./agent-intent-resolver"

interface AgentChatResult {
  blocked: boolean
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  intent: unknown
  toolCalls: string[]
  timings: Record<string, number>
  sessionId: string | null
  traceId: string | null
  trace: unknown
}

interface SessionStoreLike {
  get(sessionId: string): Promise<ModelMessage[] | null>
  save(sessionId: string, history: ModelMessage[]): Promise<void>
}

interface AgentChatDelegate {
  chat(message: string, options?: ChatOptions): Promise<AgentChatResult>
}

interface ToolFirstAgentConfig {
  delegate: AgentChatDelegate
  sessionStore: SessionStoreLike
  memoryManager?: MemoryManager | null
  lineUserId?: string
  intentResolver?: AgentIntentResolver
}

const SHORT_RECORD_PATTERN = /^記$/
const CONTEXTUAL_COMPLETE_PATTERN = /這件事|這個|那個|剛剛那個|剛才那個/i

function extractToolSummary(raw: string): string {
  const marker = "[/FACTS]"
  const markerIndex = raw.indexOf(marker)
  if (markerIndex === -1) return raw
  return raw.slice(markerIndex + marker.length).trim()
}

function parseFactsBlock(raw: string): unknown | null {
  const startMarker = "[FACTS]"
  const endMarker = "[/FACTS]"
  const startIndex = raw.indexOf(startMarker)
  const endIndex = raw.indexOf(endMarker)
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null

  const jsonText = raw.slice(startIndex + startMarker.length, endIndex).trim()
  if (!jsonText) return null

  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

async function appendSessionHistory(
  sessionStore: SessionStoreLike,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  const history = (await sessionStore.get(sessionId)) ?? []
  await sessionStore.save(sessionId, [
    ...history,
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  ])
}

function extractRecordedItems(history: ModelMessage[]): string[] {
  const items: string[] = []

  for (const message of history) {
    if (message.role !== "assistant" || typeof message.content !== "string") continue
    const text = message.content

    const singleMatch = text.match(/已記錄(?:\s+\d+\s+個項目)?：(.+)/)
    if (singleMatch?.[1]) {
      items.push(singleMatch[1].trim())
    }
  }

  return items
}

function extractLatestTaskCode(history: ModelMessage[]): string | null {
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

function extractTaskMentions(history: ModelMessage[]): string[] {
  const items: string[] = []

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant" || typeof message.content !== "string") continue
    const text = message.content
    const facts = parseFactsBlock(text) as {
      items?: Array<{ title?: string }>
      candidates?: Array<{ title?: string }>
      selectedTaskTitle?: string
    } | null

    if (facts?.selectedTaskTitle) {
      items.push(facts.selectedTaskTitle)
    }

    if (Array.isArray(facts?.items)) {
      for (const item of facts.items) {
        if (item?.title) items.push(item.title.trim())
      }
    }

    if (Array.isArray(facts?.candidates)) {
      for (const candidate of facts.candidates) {
        if (candidate?.title) items.push(candidate.title.trim())
      }
    }

    for (const pattern of [/已記錄(?:\s+\d+\s+個項目)?：(.+)/g, /你剛才記的是：(.+)/g, /是否完成「(.+?)」/g]) {
      for (const match of text.matchAll(pattern)) {
        const title = match[1]?.trim()
        if (title) items.push(title)
      }
    }

    for (const match of text.matchAll(/(?:^|\n)\d+\.\s+(.+)/g)) {
      const raw = match[1]?.trim()
      if (!raw) continue
      const title = raw
        .replace(/\s+\[[^\]]+\].*$/, "")
        .replace(/\s+[📅📌].*$/, "")
        .trim()
      if (title) items.push(title)
    }
  }

  return Array.from(new Set(items))
}

function normalizeCompletionQuery(text: string): string {
  return text
    .replace(/[：:，,。！？!?]/g, " ")
    .replace(/我以為|我已經|我剛剛|我剛才|幫我|把|將|請/g, " ")
    .replace(/我/g, " ")
    .replace(/今天|已經/g, " ")
    .replace(/這件事|這個|那個|剛剛那個|剛才那個/g, " ")
    .replace(/標記(?:成|為)?完成|標記|勾掉/g, " ")
    .replace(/跑完/g, "跑")
    .replace(/做完/g, "做")
    .replace(/處理完/g, "處理")
    .replace(/完成了|已完成|完成|弄完|搞定|done|做好了|結束了/g, " ")
    .replace(/啊|呀|啦|了/g, " ")
    .replace(/\s+/g, "")
    .trim()
}

function resolveCompletionQuery(message: string, history: ModelMessage[]): string {
  const mentions = extractTaskMentions(history)
  const normalizedQuery = normalizeCompletionQuery(message)

  if (normalizedQuery.length >= 2) {
    const matchedMention = mentions.find((mention) => {
      const normalizedMention = normalizeCompletionQuery(mention)
      return normalizedMention.length > 0
        && (normalizedQuery.includes(normalizedMention) || normalizedMention.includes(normalizedQuery))
    })
    if (matchedMention) return matchedMention
    return normalizedQuery
  }

  if (CONTEXTUAL_COMPLETE_PATTERN.test(message)) {
    return mentions[0] ?? message
  }

  return mentions[0] ?? message
}

async function appendLongTermMemory(
  memoryManager: MemoryManager | null | undefined,
  userId: string | undefined,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  if (!memoryManager || !userId) return
  await memoryManager.add(userId, [
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  ])
}

export class ToolFirstAgent {
  private readonly intentResolver: AgentIntentResolver

  constructor(private readonly config: ToolFirstAgentConfig) {
    this.intentResolver = config.intentResolver ?? new DeterministicAgentIntentResolver()
  }

  async chat(message: string, options: ChatOptions = {}): Promise<AgentChatResult> {
    const directResult = await this.tryDirectToolRoute(message, options)
    if (directResult) return directResult
    return this.config.delegate.chat(message, options)
  }

  private async tryDirectToolRoute(message: string, options: ChatOptions): Promise<AgentChatResult | null> {
    const sessionId = options.sessionId ?? "default"
    const userId = options.userId
    const trimmedMessage = message.trim()

    if (SHORT_RECORD_PATTERN.test(trimmedMessage)) {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "請直接告訴我要記錄的內容，例如任務名稱、待辦事項或想法。",
        intent: null,
        trace: null,
      })
    }

    const history = (await this.config.sessionStore.get(sessionId)) ?? []
    const { intent, trace } = await this.intentResolver.resolve({
      message: trimmedMessage,
      history,
      sessionId,
      userId,
    })

    let toolName: string | null = null
    let toolOutput: string | null = null
    let toolHistoryContent: string | null = null

    if (intent.object === "recall_task_code") {
      const taskCode = extractLatestTaskCode(history)
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: taskCode ?? "目前找不到你剛剛提到的任務代號。",
        intent,
        trace,
      })
    }

    if (intent.object === "recall_last_item") {
      const recordedItems = extractRecordedItems(history)
      const latestItem = recordedItems.at(-1)
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: latestItem
          ? `你剛才記的是：${latestItem}`
          : "目前找不到你剛才記錄的項目。",
        intent,
        trace,
      })
    }

    if (intent.object === "greeting") {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "我是 Naru，也是 Zentropy 的任務助理。目前可以幫你記錄任務、查詢待辦、標記完成、整理結構與調整分類。",
        intent,
        trace,
      })
    }

    if (intent.object === "planning") {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "完整規劃功能還在開發中。你可以先把目標記下來，我目前能先幫你記錄，之後再協助拆解規劃。",
        intent,
        trace,
      })
    }

    if (intent.object === "completed_today") {
      toolName = "query_completed_today_tasks"
      toolHistoryContent = await createQueryCompletedTodayTasksTool(userId ?? "").execute({})
      toolOutput = extractToolSummary(toolHistoryContent)
    } else if (intent.object === "today_focus") {
      toolName = "query_today_tasks"
      toolHistoryContent = await createQueryTodayTasksTool(userId ?? "").execute({})
      toolOutput = extractToolSummary(toolHistoryContent)
    } else if (intent.object === "task_capture") {
      toolName = "brain_dump"
      toolOutput = await createBrainDumpTool(userId ?? "", trimmedMessage).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "classification") {
      toolName = "adjust_tags_preview"
      toolOutput = await createAdjustTagsTool(userId ?? "", trimmedMessage).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "task_completion") {
      toolName = "complete_task_search"
      const completionQuery = resolveCompletionQuery(trimmedMessage, history)
      toolHistoryContent = await createCompleteTaskSearchTool(
        userId ?? "",
        trimmedMessage,
        this.config.lineUserId,
        completionQuery,
      ).execute({})
      toolOutput = extractToolSummary(toolHistoryContent)
      trace.targetQuery = completionQuery
    } else if (intent.object === "reorganize") {
      toolName = "reorganize_preview"
      toolOutput = await createReorganizeTool(userId ?? "").execute({})
      toolHistoryContent = toolOutput
    }

    if (!toolName || !toolOutput) {
      return null
    }

    // Groq 的這顆模型在 function calling 參數生成上不穩定。
    // 對於可由明確 trigger 決定的 skill，直接執行工具可保留產品行為並避免 provider-specific tool schema 問題。
    trace.selectedTool = toolName
    const historyContent = toolHistoryContent ?? toolOutput
    await appendSessionHistory(this.config.sessionStore, sessionId, trimmedMessage, historyContent)
    await appendLongTermMemory(this.config.memoryManager, userId, trimmedMessage, historyContent)

    return {
      blocked: false,
      content: toolOutput,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      intent,
      toolCalls: [toolName],
      timings: {},
      sessionId,
      traceId: null,
      trace,
    }
  }

  private async buildDirectResult({
    sessionId,
    message,
    content,
    intent,
    trace,
  }: {
    sessionId: string
    message: string
    content: string
    intent?: unknown
    trace?: unknown
  }): Promise<AgentChatResult> {
    await appendSessionHistory(this.config.sessionStore, sessionId, message, content)

    return {
      blocked: false,
      content,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      intent: intent ?? null,
      toolCalls: [],
      timings: {},
      sessionId,
      traceId: null,
      trace: trace ?? null,
    }
  }
}
