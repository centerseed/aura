import type { ModelMessage } from "ai"
import type { MemoryManager } from "naru-agent-js"
import type { ChatOptions } from "naru-agent-js"
import type { SessionMetaStore } from "@/application/services/agent-session-lifecycle-service"
import { createBrainDumpTool } from "./brain-dump-skill"
import { createAdjustTagsTool } from "./adjust-tags-skill"
import { createReorganizeTool } from "./reorganize-skill"
import { createQueryCompletedTodayTasksTool, createQueryTodayTasksTool } from "./query-tasks-skill"
import { shouldUseStrictTodayFocus } from "./today-focus-scope"
import {
  DeterministicAgentIntentResolver,
  type AgentIntentResolver,
} from "./agent-intent-resolver"
import { createCompleteTaskSearchTool } from "./complete-task-skill"
import { extractPresentedEntities, parseToolResult, type PresentedEntity } from "./tool-result-protocol"
import { AgentSessionStateStore, type AgentSessionState } from "./agent-session-state"
import { getLineSession, clearLineSession, saveLineSession } from "@/lib/line-session"
import type { AdjustTagsPayload, BrainDumpPendingPayload, CompleteTaskPayload } from "@/lib/line-session"
import { classifyConfirmationDisposition, extractBrainDumpConfirmationTarget } from "@/lib/line-confirmation"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { buildCompleteTaskSuccessMessage, executeCompleteTaskPayload } from "./complete-task-executor"
import { createRunPlannerTool } from "./planner-skill"
import { resolveCompletionQuery } from "./completion-query-normalizer"
import { normalizeAgentUsage } from "./llm-logging"

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
  delegate: AgentChatDelegate
  sessionStore: SessionStoreLike
  metaStore?: SessionMetaStore
  memoryManager?: MemoryManager | null
  lineUserId?: string
  intentResolver?: AgentIntentResolver
}

interface ToolFirstAgentPhaseTimings {
  pending_confirmation_ms?: number
  session_history_load_ms?: number
  intent_resolve_ms?: number
  direct_route_ms?: number
  delegate_chat_ms?: number
  delegate_history_check_ms?: number
  delegate_history_fallback_persist_ms?: number
  total_ms?: number
}

interface ToolFirstAgentUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  classifierInputTokens?: number
  classifierOutputTokens?: number
  classifierTotalTokens?: number
}

const SHORT_RECORD_PATTERN = /^記$/

// 序號引用模式：第一個、第二個、第三個...
const ORDINAL_REFERENCE_PATTERN = /第([一二三四五六七八九十\d]+)個/
const BARE_ORDINAL_PATTERN = /^([一二三四五六七八九十\d]+)$/
const ORDINAL_MAP: Record<string, number> = {
  "一": 0, "二": 1, "三": 2, "四": 3, "五": 4,
  "六": 5, "七": 6, "八": 7, "九": 8, "十": 9,
}

// 上下文引用模式：剛才記的、那個、這個
const CONTEXTUAL_REFERENCE_PATTERN = /(?:剛才|剛剛|上一個|上次|之前)(?:記的|那個|的)?|那個|這個/
const CONTEXTUAL_ADJUST_REFERENCE_PATTERN = /(?:這個任務|那個任務|這件事|這個|那個|剛剛那個|剛才那個|上一個|上個)/
const LIST_CONTEXTUAL_REFERENCE_PATTERN = /(?:第[一二三四五六七八九十\d]+個|最後一個|最後那個|那個|這個|剛剛那個|剛才那個|上一個|上個)/
const BARE_COMPLETION_REFERENCE_PATTERN = /^(?:完成了?|做完了?|搞定了?|done|好了?|處理完了?|結束了?)$/i
function resolveOrdinalIndex(message: string): number | null {
  const match = message.match(ORDINAL_REFERENCE_PATTERN)
  const bareMatch = message.trim().match(BARE_ORDINAL_PATTERN)
  const ordinalToken = match?.[1] ?? bareMatch?.[1]
  if (!ordinalToken) return null

  const ordinal = ordinalToken
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

function extractLatestPresentedEntities(history: ModelMessage[]): PresentedEntity[] {
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

function toCompleteTaskPayload(entity: PresentedEntity | RecordedEntityReference): CompleteTaskPayload | null {
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

function resolveContextualEntity(
  message: string,
  sessionState: AgentSessionState,
  history: ModelMessage[],
): PresentedEntity | RecordedEntityReference | null {
  const ordinalIndex = resolveOrdinalIndex(message)
  if (ordinalIndex !== null) {
    const presentedEntities = sessionState.lastPresentedEntities.length > 0
      ? sessionState.lastPresentedEntities
      : extractLatestPresentedEntities(history)
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

function hasRecentPresentedList(
  sessionState: AgentSessionState,
  history: ModelMessage[],
): boolean {
  if (sessionState.lastPresentedEntities.length > 0) return true
  return extractLatestPresentedEntities(history).length > 0
}

function shouldClarifyAgainstRecentList(
  message: string,
  sessionState: AgentSessionState,
  history: ModelMessage[],
): boolean {
  if (!LIST_CONTEXTUAL_REFERENCE_PATTERN.test(message)) return false
  return hasRecentPresentedList(sessionState, history)
}

function buildListClarificationMessage(): string {
  return "我知道你是在指剛剛那份清單，但還不能確定是哪一項。你是指清單中的哪一個？請直接回覆序號或完整名稱。"
}

function resolveQueryDayOffset(
  message: string,
  trace: import("./agent-intent").AgentDecisionTrace,
): number | undefined {
  if (trace.metadata?.temporalScope !== "future") return undefined
  if (/明天/.test(message)) return 1
  return undefined
}

function toTaskPresentedEntity(
  entity: PresentedEntity | RecordedEntityReference | null,
): PresentedEntity | null {
  if (!entity || isRecordedEntityReference(entity)) return null
  if (entity.entityType !== "task" || !entity.taskId) return null
  return entity
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
    const startedAt = Date.now()
    const phaseTimings: ToolFirstAgentPhaseTimings = {}
    const finish = (
      result: AgentChatResult,
      route: "short_circuit" | "pending_confirmation" | "direct_tool" | "delegate",
    ): AgentChatResult => {
      const classifierUsage = extractClassifierUsage(result.trace)
      const usage = {
        ...normalizeAgentUsage(result.usage),
        ...(classifierUsage
          ? {
              classifierInputTokens: classifierUsage.inputTokens,
              classifierOutputTokens: classifierUsage.outputTokens,
              classifierTotalTokens: classifierUsage.totalTokens,
            }
          : {}),
      } satisfies ToolFirstAgentUsage
      const timings = {
        ...phaseTimings,
        ...result.timings,
        total_ms: Date.now() - startedAt,
      }
      const intentObject = extractIntentObject(result.intent)
      console.log(JSON.stringify({
        event: "tool_first_agent_chat_complete",
        sessionId,
        userId,
        route,
        message_len: trimmedMessage.length,
        intent_object: intentObject,
        toolCalls: result.toolCalls,
        timings,
        usage,
      }))

      return {
        ...result,
        timings,
      }
    }

    try {
      // Ultra-short pattern: no intent resolution needed
      if (SHORT_RECORD_PATTERN.test(trimmedMessage)) {
        return finish(await this.buildDirectResult({
          sessionId,
          message: trimmedMessage,
          content: "請直接告訴我要記錄的內容，例如任務名稱、待辦事項或想法。",
          intent: null,
          trace: null,
        }), "short_circuit")
      }

      // Pending confirmation: check if user is responding to a preview
      if (this.config.lineUserId) {
        const pendingStartedAt = Date.now()
        const pendingResult = await this.handlePendingConfirmation(
          trimmedMessage, sessionId, userId,
        )
        phaseTimings.pending_confirmation_ms = Date.now() - pendingStartedAt
        if (pendingResult) return finish(pendingResult, "pending_confirmation")
      }

      const historyStartedAt = Date.now()
      const history = (await this.config.sessionStore.get(sessionId)) ?? []
      phaseTimings.session_history_load_ms = Date.now() - historyStartedAt

      // Resolve intent once
      const sessionState = this.agentSessionStateStore
        ? await this.agentSessionStateStore.get(sessionId)
        : { lastPresentedEntities: [], lastRecordedEntities: [] }
      const resolveStartedAt = Date.now()
      const { intent, trace } = await this.intentResolver.resolve({
        message: trimmedMessage,
        history,
        sessionId,
        userId,
      })
      phaseTimings.intent_resolve_ms = Date.now() - resolveStartedAt

      const routedIntent = intent.object === "unknown" &&
        resolveOrdinalIndex(trimmedMessage) !== null &&
        hasRecentPresentedList(sessionState, history)
        ? {
            ...intent,
            object: "task_completion" as const,
            requiresConfirmation: true,
            confidence: 0.9,
          }
        : intent

      // Try deterministic fast-path (only for self-contained intents)
      const directStartedAt = Date.now()
      const directResult = await this.tryDirectToolRoute(
        trimmedMessage, sessionId, userId, routedIntent, trace, history, sessionState,
      )
      phaseTimings.direct_route_ms = Date.now() - directStartedAt
      if (directResult) return finish(directResult, "direct_tool")

      // Last resort: delegate
      const delegateStartedAt = Date.now()
      const delegateResult = await this.config.delegate.chat(message, options)
      phaseTimings.delegate_chat_ms = Date.now() - delegateStartedAt

      // Ensure the delegate's response is persisted so that follow-up messages
      // (e.g. "是的" confirming a brain-dump prompt) can read it from history.
      // The real NaruAgent saves its own history; if session was not updated by
      // the delegate (e.g. mock in tests), save it here.
      const historyCheckStartedAt = Date.now()
      const historyAfterDelegate = (await this.config.sessionStore.get(sessionId)) ?? []
      const delegateUpdatedSession = historyAfterDelegate.length > history.length
      phaseTimings.delegate_history_check_ms = Date.now() - historyCheckStartedAt
      if (!delegateUpdatedSession) {
        const fallbackPersistStartedAt = Date.now()
        await appendSessionHistory(
          this.config.sessionStore, sessionId, trimmedMessage, delegateResult.content,
        )
        phaseTimings.delegate_history_fallback_persist_ms = Date.now() - fallbackPersistStartedAt
      }

      if (this.config.lineUserId) {
        const pendingBrainDumpTarget = extractBrainDumpConfirmationTarget(delegateResult.content)
        if (pendingBrainDumpTarget) {
          await saveLineSession(this.config.lineUserId, "brain_dump_pending", {
            originalText: pendingBrainDumpTarget,
            taskTitle: pendingBrainDumpTarget,
          })
        }
      }

      return finish(delegateResult, "delegate")
    } catch (error) {
      console.error(JSON.stringify({
        event: "tool_first_agent_chat_error",
        sessionId,
        userId,
        message_len: trimmedMessage.length,
        timings: {
          ...phaseTimings,
          total_ms: Date.now() - startedAt,
        },
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
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
      toolHistoryContent = await createQueryTodayTasksTool(userId ?? "", {
        strictToday: shouldUseStrictTodayFocus(trimmedMessage),
        dayOffset: resolveQueryDayOffset(trimmedMessage, trace),
      }).execute({})
      toolOutput = parseToolResult(toolHistoryContent).summary
    } else if (intent.object === "task_capture" && intent.confidence >= 0.95) {
      toolName = "brain_dump"
      toolOutput = await createBrainDumpTool(userId ?? "", trimmedMessage).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "classification") {
      const hasContextualReference = CONTEXTUAL_ADJUST_REFERENCE_PATTERN.test(trimmedMessage)
      const resolvedTaskContext = hasContextualReference
        ? toTaskPresentedEntity(resolveContextualEntity(trimmedMessage, sessionState, history))
        : null
      const hasEntityContext = Boolean(resolvedTaskContext)
      if (hasContextualReference && !hasEntityContext) {
        return this.buildDirectResult({
          sessionId,
          message: trimmedMessage,
          content: "我還不知道你指的是哪個任務。請直接告訴我任務名稱，再說要移到哪個分類。",
          intent,
          trace,
        })
      }
      toolName = "adjust_tags_preview"
      toolOutput = await createAdjustTagsTool(
        userId ?? "",
        trimmedMessage,
        this.config.lineUserId,
        resolvedTaskContext ?? undefined,
      ).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "reorganize") {
      toolName = "reorganize_preview"
      toolOutput = await createReorganizeTool(userId ?? "").execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "task_completion") {
      const contextualEntity = resolveContextualEntity(trimmedMessage, sessionState, history)
      const contextualPayload = contextualEntity ? toCompleteTaskPayload(contextualEntity) : null

      if (contextualPayload) {
        await executeCompleteTaskPayload(userId ?? "", contextualPayload)
        toolName = "complete_task_search"
        toolOutput = buildCompleteTaskSuccessMessage(contextualPayload.taskTitle)
        toolHistoryContent = toolOutput
      }

      if (toolOutput) {
        // 已用 canonical entity 建立確認，不需再走語意搜尋
      } else {
        if (shouldClarifyAgainstRecentList(trimmedMessage, sessionState, history)) {
          return this.buildDirectResult({
            sessionId,
            message: trimmedMessage,
            content: buildListClarificationMessage(),
            intent,
            trace,
          })
        }

        // 嘗試確定性解析序號/上下文引用，成功則直接呼叫 tool
        const resolvedQuery = contextualEntity?.title ?? resolveContextualQuery(trimmedMessage, sessionState, history)
        if (resolvedQuery) {
          toolName = "complete_task_search"
          toolOutput = await createCompleteTaskSearchTool(
            userId ?? "", trimmedMessage, this.config.lineUserId, resolvedQuery,
          ).execute({})
          toolHistoryContent = toolOutput
        }

        if (!toolOutput) {
          const normalizedQuery = await resolveCompletionQuery(trimmedMessage)
          toolName = "complete_task_search"
          toolOutput = await createCompleteTaskSearchTool(
            userId ?? "", normalizedQuery || trimmedMessage, this.config.lineUserId,
          ).execute({})
          toolHistoryContent = toolOutput
        }
      }
    } else if (intent.object === "planning") {
      toolName = "run_planner"
      toolOutput = await createRunPlannerTool(userId ?? "", trimmedMessage).execute({})
      toolHistoryContent = toolOutput
    }

    if (!toolName || !toolOutput) {
      return null
    }

    trace.selectedTool = toolName
    return this.finalizeToolRoute({
      sessionId,
      userId,
      message: trimmedMessage,
      toolName,
      toolOutput,
      toolHistoryContent,
      intent,
      trace,
    })
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
        toolName: "adjust_tags_preview",
        toolOutput: `✅ 已完成分類調整：\n\n${summary}`,
        trace: {
          selectedTool: "adjust_tags_preview",
          routeSource: "pending_confirmation",
        },
      })
    }

    if (session.type === "complete_task_confirm") {
      const p = session.payload as CompleteTaskPayload
      try {
        await executeCompleteTaskPayload(userId ?? "", p)
      } catch {
        await clearLineSession(key)
        return this.buildDirectResult({
          sessionId,
          message,
          content: "發生錯誤：無法識別要完成的任務。",
        })
      }
      await clearLineSession(key)
      const successMessage = buildCompleteTaskSuccessMessage(p.taskTitle)
      return this.buildDirectResult({
        sessionId,
        message,
        content: successMessage,
        toolName: "complete_task_search",
        toolOutput: successMessage,
        trace: {
          selectedTool: "complete_task_search",
          routeSource: "pending_confirmation",
        },
      })
    }

    if (session.type === "brain_dump_pending") {
      const p = session.payload as BrainDumpPendingPayload
      const toolOutput = await createBrainDumpTool(userId ?? "", p.originalText).execute({})
      await clearLineSession(key)
      return this.finalizeToolRoute({
        sessionId,
        userId,
        message,
        toolName: "brain_dump",
        toolOutput,
        toolHistoryContent: toolOutput,
        intent: {
          object: "task_capture",
          requiresConfirmation: false,
          confidence: 1,
        },
        trace: {
          routeSource: "intent_resolver",
          resolver: "line_pending_session",
          rawMessage: message,
          resolvedIntent: {
            object: "task_capture",
            requiresConfirmation: false,
            confidence: 1,
          },
          metadata: {
            speechAct: "confirm",
            targetReferenceMode: "contextual",
            temporalScope: "past",
            reasonCodes: ["pending_brain_dump_confirmation"],
          },
          selectedTool: "brain_dump",
          targetQuery: p.originalText,
        },
      })
    }

    // Unknown session type — clear and proceed
    await clearLineSession(key)
    return null
  }

  private async finalizeToolRoute({
    sessionId,
    userId,
    message,
    toolName,
    toolOutput,
    toolHistoryContent,
    intent,
    trace,
  }: {
    sessionId: string
    userId: string | undefined
    message: string
    toolName: string
    toolOutput: string
    toolHistoryContent?: string
    intent: unknown
    trace: unknown
  }): Promise<AgentChatResult> {
    const historyContent = toolHistoryContent ?? toolOutput
    await appendSessionHistory(this.config.sessionStore, sessionId, message, historyContent)
    await this.persistCanonicalSessionState(sessionId, historyContent)
    await appendLongTermMemory(this.config.memoryManager, userId, message, historyContent)

    return {
      blocked: false,
      content: parseToolResult(toolOutput).summary,
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

  private async buildDirectResult({
    sessionId,
    message,
    content,
    intent,
    trace,
    toolName,
    toolOutput,
  }: {
    sessionId: string
    message: string
    content: string
    intent?: unknown
    trace?: unknown
    toolName?: string
    toolOutput?: string
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
      toolCalls: toolName ? [toolName] : [],
      toolOutputs: toolOutput ? [toolOutput] : [],
      timings: {},
      sessionId,
      traceId: null,
      trace: trace ?? null,
    }
  }
}

function extractIntentObject(intent: unknown): string | null {
  if (!intent || typeof intent !== "object") return null
  const value = (intent as { object?: unknown }).object
  return typeof value === "string" ? value : null
}

function extractClassifierUsage(trace: unknown): {
  inputTokens: number
  outputTokens: number
  totalTokens: number
} | null {
  if (!trace || typeof trace !== "object") return null
  const classifierUsage = (trace as {
    metadata?: {
      classifierUsage?: {
        inputTokens?: unknown
        outputTokens?: unknown
        totalTokens?: unknown
      }
    }
  }).metadata?.classifierUsage

  if (!classifierUsage) return null

  return {
    inputTokens: typeof classifierUsage.inputTokens === "number" ? classifierUsage.inputTokens : 0,
    outputTokens: typeof classifierUsage.outputTokens === "number" ? classifierUsage.outputTokens : 0,
    totalTokens: typeof classifierUsage.totalTokens === "number" ? classifierUsage.totalTokens : 0,
  }
}
