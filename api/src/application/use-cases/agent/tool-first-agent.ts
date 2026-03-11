import type { ModelMessage } from "ai"
import type { MemoryManager } from "naru-agent-js"
import type { ChatOptions } from "naru-agent-js"
import type { SessionMetaStore } from "@/application/services/agent-session-lifecycle-service"
import { createBrainDumpTool } from "./brain-dump-skill"
import { createAdjustTagsTool } from "./adjust-tags-skill"
import { createReorganizeTool } from "./reorganize-skill"
import { createQueryCompletedTodayTasksTool, createQueryTodayTasksTool } from "./query-tasks-skill"
import {
  DeterministicAgentIntentResolver,
  type AgentIntentResolver,
} from "./agent-intent-resolver"
import type { IntentAwareExecutor } from "./intent-aware-executor"
import { createCompleteTaskSearchTool } from "./complete-task-skill"
import { extractPresentedEntities, parseToolResult, type PresentedEntity } from "./tool-result-protocol"
import { AgentSessionStateStore, type AgentSessionState } from "./agent-session-state"
import { getLineSession, clearLineSession, saveLineSession } from "@/lib/line-session"
import type { AdjustTagsPayload, CompleteTaskPayload } from "@/lib/line-session"
import { classifyConfirmationDisposition } from "@/lib/line-confirmation"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { CompleteTaskUseCase } from "@/application/use-cases/tasks/complete-task"
import { UpdateSubItemUseCase } from "@/application/use-cases/tasks/update-sub-item"
import { UpdatePlanItemUseCase } from "@/application/use-cases/coach/update-plan-item"

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
  toolOutputs?: string[]
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
  executor?: IntentAwareExecutor
  delegate: AgentChatDelegate
  sessionStore: SessionStoreLike
  metaStore?: SessionMetaStore
  memoryManager?: MemoryManager | null
  lineUserId?: string
  intentResolver?: AgentIntentResolver
}

const SHORT_RECORD_PATTERN = /^記$/

// 序號引用模式：第一個、第二個、第三個...
const ORDINAL_REFERENCE_PATTERN = /第([一二三四五六七八九十\d]+)個/
const ORDINAL_MAP: Record<string, number> = {
  "一": 0, "二": 1, "三": 2, "四": 3, "五": 4,
  "六": 5, "七": 6, "八": 7, "九": 8, "十": 9,
}

// 上下文引用模式：剛才記的、那個、這個
const CONTEXTUAL_REFERENCE_PATTERN = /(?:剛才|剛剛|上一個|上次|之前)(?:記的|那個|的)?|那個|這個/

function resolveOrdinalIndex(message: string): number | null {
  const match = message.match(ORDINAL_REFERENCE_PATTERN)
  if (!match?.[1]) return null

  const ordinal = match[1]
  // 數字
  const num = Number(ordinal)
  if (!Number.isNaN(num)) return num - 1

  // 中文
  const mapped = ORDINAL_MAP[ordinal]
  return mapped ?? null
}

function resolveContextualQuery(
  message: string,
  sessionState: AgentSessionState,
  history: ModelMessage[],
): string | null {
  // 1. 序號引用：第一個、第二個...
  const ordinalIndex = resolveOrdinalIndex(message)
  if (ordinalIndex !== null) {
    const mentions = sessionState.lastPresentedEntities.length > 0
      ? sessionState.lastPresentedEntities.map((entity) => entity.title)
      : extractTaskMentions(history)
    if (ordinalIndex >= 0 && ordinalIndex < mentions.length) {
      return mentions[ordinalIndex] ?? null
    }
  }

  // 2. 上下文引用：剛才記的那個、那個...
  if (CONTEXTUAL_REFERENCE_PATTERN.test(message)) {
    const recordedItems = sessionState.lastRecordedEntities.length > 0
      ? sessionState.lastRecordedEntities.map((entity) => entity.title)
      : extractRecordedItems(history)
    if (recordedItems.length > 0) {
      return recordedItems.at(-1) ?? null
    }
    // 沒有 recorded items，嘗試用 mentions 的最後一個
    const mentions = extractTaskMentions(history)
    if (mentions.length > 0) {
      return mentions.at(-1) ?? null
    }
  }

  return null
}

function parseFactsBlock(raw: string): unknown | null {
  return parseToolResult(raw).facts
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

    // 優先抓「」內的精確標題（如：已記錄並追加：「整理履歷」追加 1 個待辦）
    for (const match of text.matchAll(/已記錄[^：]*：.*?「([^」]+)」/g)) {
      if (match[1]) items.push(match[1].trim())
    }

    // 處理 "已記錄 N 個項目：標題1、標題2" 格式（無「」包圍）
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

interface RecordedEntityReference {
  title: string
  sourceType?: CompleteTaskPayload["sourceType"]
  taskId?: string
  subTaskId?: string
  planItemId?: string
}

function isRecordedEntityReference(value: PresentedEntity | RecordedEntityReference): value is RecordedEntityReference {
  return "sourceType" in value
}

function extractLatestRecordedEntity(history: ModelMessage[]): RecordedEntityReference | null {
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

/**
 * 從歷史中提取任務 mentions — 只取最近一個含有清單的 assistant message。
 * 避免跨輪次混池導致序號漂移。
 */
export function extractTaskMentions(history: ModelMessage[]): string[] {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant" || typeof message.content !== "string") continue
    const items = extractMentionsFromSingleMessage(message.content)
    if (items.length > 0) return items
  }
  return []
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
  private readonly agentSessionStateStore?: AgentSessionStateStore

  constructor(private readonly config: ToolFirstAgentConfig) {
    this.intentResolver = config.intentResolver ?? new DeterministicAgentIntentResolver()
    this.agentSessionStateStore = config.metaStore ? new AgentSessionStateStore(config.metaStore) : undefined
  }

  async chat(message: string, options: ChatOptions = {}): Promise<AgentChatResult> {
    const sessionId = options.sessionId ?? "default"
    const userId = options.userId
    const trimmedMessage = message.trim()

    // Ultra-short pattern: no intent resolution needed
    if (SHORT_RECORD_PATTERN.test(trimmedMessage)) {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "請直接告訴我要記錄的內容，例如任務名稱、待辦事項或想法。",
        intent: null,
        trace: null,
      })
    }

    // Pending confirmation: check if user is responding to a preview
    if (this.config.lineUserId) {
      const pendingResult = await this.handlePendingConfirmation(
        trimmedMessage, sessionId, userId,
      )
      if (pendingResult) return pendingResult
    }

    // Resolve intent once
    const history = (await this.config.sessionStore.get(sessionId)) ?? []
    const sessionState = this.agentSessionStateStore
      ? await this.agentSessionStateStore.get(sessionId)
      : { lastPresentedEntities: [], lastRecordedEntities: [] }
    const { intent, trace } = await this.intentResolver.resolve({
      message: trimmedMessage,
      history,
      sessionId,
      userId,
    })

    // Try deterministic fast-path (only for self-contained intents)
    const directResult = await this.tryDirectToolRoute(
      trimmedMessage, sessionId, userId, intent, trace, history, sessionState,
    )
    if (directResult) return directResult

    // Executor fallback: LLM tool calling with full context
    if (this.config.executor) {
      const result = await this.config.executor.execute({
        message: trimmedMessage,
        intent,
        trace,
        history,
        sessionId,
      })

      await appendSessionHistory(this.config.sessionStore, sessionId, trimmedMessage, result.content)
      await appendLongTermMemory(this.config.memoryManager, userId, trimmedMessage, result.content)
      return result
    }

    // Last resort: delegate
    return this.config.delegate.chat(message, options)
  }

  private async tryDirectToolRoute(
    trimmedMessage: string,
    sessionId: string,
    userId: string | undefined,
    intent: import("./agent-intent").AgentIntent,
    trace: import("./agent-intent").AgentDecisionTrace,
    history: ModelMessage[],
    sessionState: AgentSessionState,
  ): Promise<AgentChatResult | null> {

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
      const recordedItems = sessionState.lastRecordedEntities.length > 0
        ? sessionState.lastRecordedEntities.map((entity) => entity.title)
        : extractRecordedItems(history)
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
        content: "我是 Naru，也是 Zentropy 的任務助理。目前可以幫你記錄任務、查詢待辦、標記完成、規劃目標、整理結構與調整分類。",
        intent,
        trace,
      })
    }

    if (intent.object === "completed_today") {
      toolName = "query_completed_today_tasks"
      toolHistoryContent = await createQueryCompletedTodayTasksTool(userId ?? "").execute({})
      toolOutput = parseToolResult(toolHistoryContent).summary
    } else if (intent.object === "today_focus") {
      toolName = "query_today_tasks"
      toolHistoryContent = await createQueryTodayTasksTool(userId ?? "").execute({})
      toolOutput = parseToolResult(toolHistoryContent).summary
    } else if (intent.object === "task_capture" && intent.confidence >= 0.95) {
      toolName = "brain_dump"
      toolOutput = await createBrainDumpTool(userId ?? "", trimmedMessage).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "classification") {
      toolName = "adjust_tags_preview"
      toolOutput = await createAdjustTagsTool(userId ?? "", trimmedMessage, this.config.lineUserId).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "reorganize") {
      toolName = "reorganize_preview"
      toolOutput = await createReorganizeTool(userId ?? "").execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "task_completion") {
      const latestRecordedEntity = CONTEXTUAL_REFERENCE_PATTERN.test(trimmedMessage)
        ? sessionState.lastRecordedEntities.at(-1) ?? extractLatestRecordedEntity(history)
        : null

      if (latestRecordedEntity && isRecordedEntityReference(latestRecordedEntity) && latestRecordedEntity.sourceType && latestRecordedEntity.taskId && this.config.lineUserId) {
        const payload: CompleteTaskPayload = {
          sourceType: latestRecordedEntity.sourceType,
          taskTitle: latestRecordedEntity.title,
          taskId: latestRecordedEntity.taskId,
          subTaskId: latestRecordedEntity.subTaskId,
          planItemId: latestRecordedEntity.planItemId,
        }
        await saveLineSession(this.config.lineUserId, "complete_task_confirm", payload)
        toolName = "complete_task_search"
        toolOutput = `是否完成「${latestRecordedEntity.title}」？\n\n回覆「確認」執行，或無視此訊息取消。`
        toolHistoryContent = toolOutput
      }

      if (toolOutput) {
        // 已用 canonical entity 建立確認，不需再走語意搜尋
      } else {
      // 嘗試確定性解析序號/上下文引用，成功則直接呼叫 tool
        const resolvedQuery = resolveContextualQuery(trimmedMessage, sessionState, history)
        if (resolvedQuery) {
          toolName = "complete_task_search"
          toolOutput = await createCompleteTaskSearchTool(
            userId ?? "", trimmedMessage, this.config.lineUserId, resolvedQuery,
          ).execute({})
          toolHistoryContent = toolOutput
        }
      }
      // 無法解析 → toolName 仍為 null → 下面 return null → 交給 executor
    }

    if (!toolName || !toolOutput) {
      return null
    }

    trace.selectedTool = toolName
    const historyContent = toolHistoryContent ?? toolOutput
    await appendSessionHistory(this.config.sessionStore, sessionId, trimmedMessage, historyContent)
    await this.persistCanonicalSessionState(sessionId, historyContent)
    await appendLongTermMemory(this.config.memoryManager, userId, trimmedMessage, historyContent)

    // 統一 strip FACTS — 無論哪個分支，最終給用戶看的 content 一定不含 [FACTS] JSON
    const safeContent = parseToolResult(toolOutput).summary

    return {
      blocked: false,
      content: safeContent,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      intent,
      toolCalls: [toolName],
      toolOutputs: [toolOutput],
      timings: {},
      sessionId,
      traceId: null,
      trace,
    }
  }

  private async persistCanonicalSessionState(sessionId: string, rawToolOutput: string): Promise<void> {
    if (!this.agentSessionStateStore) return

    const { facts } = parseToolResult(rawToolOutput)
    const presentedEntities = extractPresentedEntities(facts)
    const recordedItems = Array.isArray((facts as { recordedItems?: unknown[] } | null)?.recordedItems)
      ? ((facts?.recordedItems as Array<Record<string, unknown>>)
        .map((item, index) => {
          const title = typeof item.title === "string" ? item.title.trim() : ""
          if (!title) return null
          return {
            position: typeof item.position === "number" ? item.position : index + 1,
            title,
            entityId: undefined,
            entityType: typeof item.sourceType === "string" ? item.sourceType : undefined,
            taskId: typeof item.taskId === "string" ? item.taskId : undefined,
            subTaskId: typeof item.subTaskId === "string" ? item.subTaskId : undefined,
            planItemId: typeof item.planItemId === "string" ? item.planItemId : undefined,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null))
      : []

    if (presentedEntities.length === 0 && recordedItems.length === 0) return

    await this.agentSessionStateStore.save(sessionId, (current) => ({
      lastPresentedEntities: presentedEntities.length > 0 ? presentedEntities : current.lastPresentedEntities,
      lastRecordedEntities: recordedItems.length > 0 ? recordedItems : current.lastRecordedEntities,
    }))
  }

  private async handlePendingConfirmation(
    message: string,
    sessionId: string,
    userId: string | undefined,
  ): Promise<AgentChatResult | null> {
    const key = this.config.lineUserId!
    const session = await getLineSession(key)
    if (!session) return null

    const disposition = classifyConfirmationDisposition(message)

    if (disposition === "reject") {
      await clearLineSession(key)
      return this.buildDirectResult({
        sessionId,
        message,
        content: "好的，已取消。",
      })
    }

    if (disposition === "override") {
      await clearLineSession(key)
      return null // continue to normal agent flow
    }

    // disposition === "confirm" → execute pending operation
    if (session.type === "adjust_tags_preview") {
      const p = session.payload as AdjustTagsPayload
      const executeUC = new ExecuteAdjustmentUseCase()
      const result = await executeUC.execute({
        userId: userId ?? "",
        intentType: p.intentType,
        taskMatches: p.taskMatches,
        targetArea: p.targetArea,
        targetProduct: p.targetProduct,
        targetTopic: p.targetTopic,
        taskMap: p.taskMap as Parameters<typeof executeUC.execute>[0]["taskMap"],
        logId: p.logId,
      })
      await clearLineSession(key)
      const summary = result.operationLog.join("\n")
      return this.buildDirectResult({
        sessionId,
        message,
        content: `✅ 已完成分類調整：\n\n${summary}`,
      })
    }

    if (session.type === "complete_task_confirm") {
      const p = session.payload as CompleteTaskPayload
      if (p.sourceType === "sub_task" && p.taskId && p.subTaskId) {
        await new UpdateSubItemUseCase().execute({
          taskId: p.taskId,
          subItemId: p.subTaskId,
          userId: userId ?? "",
          completed: true,
        })
      } else if (p.sourceType === "daily_plan_item" && p.planItemId) {
        await new UpdatePlanItemUseCase().execute({
          itemId: p.planItemId,
          userId: userId ?? "",
          completed: true,
        })
      } else if (p.taskId) {
        await new CompleteTaskUseCase().execute({
          taskId: p.taskId,
          userId: userId ?? "",
        })
      } else {
        await clearLineSession(key)
        return this.buildDirectResult({
          sessionId,
          message,
          content: "發生錯誤：無法識別要完成的任務。",
        })
      }
      await clearLineSession(key)
      return this.buildDirectResult({
        sessionId,
        message,
        content: `✅ 已完成「${p.taskTitle}」`,
      })
    }

    // Unknown session type — clear and proceed
    await clearLineSession(key)
    return null
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
      toolOutputs: [],
      timings: {},
      sessionId,
      traceId: null,
      trace: trace ?? null,
    }
  }
}
