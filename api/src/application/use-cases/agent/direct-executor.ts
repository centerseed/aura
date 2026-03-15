/**
 * DirectExecutor — 高信心度直接工具執行模組
 *
 * 職責：對於有高信心度 intent 的訊息，直接呼叫對應工具，跳過 LLM delegate。
 * 邏輯從 ToolFirstAgent.tryDirectToolRoute 原封搬出。
 *
 * 回傳 null 表示需要 delegate（LLM 路由）。
 */

import type { ModelMessage } from "ai"
import type { BaseDirectExecutor, OrchestratorIntent, OrchestrationResult } from "@centerseedwu/naru-agent"
import { createBrainDumpTool } from "./brain-dump-skill"
import { createAdjustTagsTool } from "./adjust-tags-skill"
import { createReorganizeTool } from "./reorganize-skill"
import { createQueryCompletedTodayTasksTool, createQueryTodayTasksTool } from "./query-tasks-skill"
import { shouldUseStrictTodayFocus } from "./today-focus-scope"
import { serializeFactsSummary, parseToolResult, extractPresentedEntities } from "./tool-result-protocol"
import { createRunPlannerTool } from "./planner-skill"
import { createQueryCalendarTool } from "./query-calendar-skill"
import { toCalendarUnavailableMessage } from "./agent-calendar-query-service"
import { createTaskFromCalendarEvent } from "./create-task-from-calendar-event"
import type { AgentIntent, AgentDecisionTrace, AgentIntentObject } from "./agent-intent"
import { handleTaskCompletion } from "./task-completion-handler"
import type { AgentSessionState } from "./agent-session-state"
import type { PresentedEntity } from "./tool-result-protocol"
import {
  ContextResolver,
  type RecordedEntityReference,
  toTaskPresentedEntity,
  isPresentedEntity,
  hasRecentPresentedList,
  CONTEXTUAL_ADJUST_REFERENCE_PATTERN,
  extractRecordedItems,
  extractLatestTaskCode,
} from "./context-resolver"

export interface DirectExecutorResult {
  content: string
  toolName: string | null
  toolOutput: string | null
  toolHistoryContent: string | null
  intent: AgentIntent
  trace: AgentDecisionTrace
}

function resolveQueryDayOffset(
  message: string,
  trace: AgentDecisionTrace,
): number | undefined {
  if (trace.metadata?.temporalScope !== "future") return undefined
  if (/明天/.test(message)) return 1
  return undefined
}

export interface DirectExecutorConfig {
  /** 訊息發送者的系統 userId */
  userId: string
  /** LINE confirmation key（有則啟用 LINE pending session 機制） */
  confirmationKey?: string
  /** Channel-neutral callback to persist a pending confirmation state */
  savePendingState?: (sessionId: string, type: string, payload: unknown) => Promise<void>
}

export class DirectExecutor {
  private readonly contextResolver = new ContextResolver()

  constructor(private readonly config: DirectExecutorConfig) {}

  /**
   * 嘗試直接執行工具。回傳結果或 null（表示需要 delegate）。
   */
  async tryExecute(input: {
    message: string
    intent: AgentIntent
    trace: AgentDecisionTrace
    history: ModelMessage[]
    sessionState: AgentSessionState
  }): Promise<DirectExecutorResult | null> {
    const { message, intent, trace, history, sessionState } = input
    const userId = this.config.userId
    const confirmationKey = this.config.confirmationKey

    if (intent.object === "short_record") {
      return {
        content: "請直接告訴我要記錄的內容，例如任務名稱、待辦事項或想法。",
        toolName: null,
        toolOutput: null,
        toolHistoryContent: null,
        intent,
        trace,
      }
    }

    if (intent.object === "recall_task_code") {
      const taskCode = extractLatestTaskCode(history)
      return {
        content: taskCode ?? "目前找不到你剛剛提到的任務代號。",
        toolName: null,
        toolOutput: null,
        toolHistoryContent: null,
        intent,
        trace,
      }
    }

    if (intent.object === "recall_last_item") {
      const recordedItems = sessionState.lastRecordedEntities.length > 0
        ? sessionState.lastRecordedEntities.map((entity) => entity.title)
        : extractRecordedItems(history)
      const latestItem = recordedItems.at(-1)
      return {
        content: latestItem
          ? `你剛才記的是：${latestItem}`
          : "目前找不到你剛才記錄的項目。",
        toolName: null,
        toolOutput: null,
        toolHistoryContent: null,
        intent,
        trace,
      }
    }

    if (intent.object === "greeting") {
      return {
        content: "我是 Naru，也是 Zentropy 的助理。目前可以幫你記錄任務、查詢待辦、查今天或明天的會議空檔、標記完成、規劃目標、整理結構與調整分類。",
        toolName: null,
        toolOutput: null,
        toolHistoryContent: null,
        intent,
        trace,
      }
    }

    let toolName: string | null = null
    let toolOutput: string | null = null
    let toolHistoryContent: string | null = null

    if (intent.object === "completed_today") {
      toolName = "query_completed_today_tasks"
      toolHistoryContent = await createQueryCompletedTodayTasksTool(userId).execute({})
      toolOutput = parseToolResult(toolHistoryContent).summary
    } else if (intent.object === "today_focus") {
      toolName = "query_today_tasks"
      toolHistoryContent = await createQueryTodayTasksTool(userId, {
        strictToday: shouldUseStrictTodayFocus(message),
        dayOffset: resolveQueryDayOffset(message, trace),
      }).execute({})
      toolOutput = parseToolResult(toolHistoryContent).summary
    } else if (intent.object === "calendar_query") {
      try {
        toolName = "query_calendar"
        toolHistoryContent = await createQueryCalendarTool(userId, message).execute({})
        toolOutput = parseToolResult(toolHistoryContent).summary
      } catch (error) {
        const unavailableMessage = toCalendarUnavailableMessage(error)
        if (unavailableMessage) {
          return {
            content: unavailableMessage,
            toolName: null,
            toolOutput: null,
            toolHistoryContent: null,
            intent,
            trace,
          }
        }
        throw error
      }
    } else if (intent.object === "calendar_task_link") {
      const contextualEntity = this.contextResolver.resolveContextualEntity(message, sessionState, history)
      if (
        !contextualEntity
        || !isPresentedEntity(contextualEntity)
        || contextualEntity.entityType !== "calendar_event"
      ) {
        return {
          content: hasRecentPresentedList(sessionState, history)
            ? "我知道你是在指剛剛那份清單，但目前只能把 calendar event 轉成任務。請直接回覆行程序號。"
            : "我還不知道你指的是哪個行程。先叫我查行事曆，然後回覆像「把第 1 個加到任務」。",
          toolName: null,
          toolOutput: null,
          toolHistoryContent: null,
          intent,
          trace,
        }
      }

      if (!contextualEntity.entityId || !contextualEntity.start || !contextualEntity.end) {
        return {
          content: "我拿不到這個行程的完整資訊，請重新查一次行事曆後再試。",
          toolName: null,
          toolOutput: null,
          toolHistoryContent: null,
          intent,
          trace,
        }
      }

      toolName = "create_task_from_calendar_event"
      const linkedTask = await createTaskFromCalendarEvent({
        userId,
        eventId: contextualEntity.entityId,
        title: contextualEntity.title,
        start: contextualEntity.start,
        end: contextualEntity.end,
        description: contextualEntity.description,
        eventLink: contextualEntity.eventLink,
        meetLink: contextualEntity.meetLink,
        attendees: contextualEntity.attendees,
      })
      toolOutput = serializeFactsSummary({
        recordedItems: [{
          position: 1,
          title: linkedTask.taskTitle,
          sourceType: "task",
          taskId: linkedTask.taskId,
        }],
        linkedCalendarEvent: {
          eventId: contextualEntity.entityId,
          title: contextualEntity.title,
          taskId: linkedTask.taskId,
        },
      }, `已建立 INBOX 任務「${linkedTask.taskTitle}」，並把這個 calendar event 關聯到該任務。`)
      toolHistoryContent = toolOutput
    } else if (intent.object === "task_capture" && intent.confidence >= 0.95) {
      toolName = "brain_dump"
      toolOutput = await createBrainDumpTool(userId, message).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "classification") {
      const hasContextualReference = CONTEXTUAL_ADJUST_REFERENCE_PATTERN.test(message)
      const resolvedTaskContext = hasContextualReference
        ? toTaskPresentedEntity(
            this.contextResolver.resolveContextualEntity(message, sessionState, history),
          )
        : null
      const hasEntityContext = Boolean(resolvedTaskContext)
      if (hasContextualReference && !hasEntityContext) {
        return {
          content: "我還不知道你指的是哪個任務。請直接告訴我任務名稱，再說要移到哪個分類。",
          toolName: null,
          toolOutput: null,
          toolHistoryContent: null,
          intent,
          trace,
        }
      }
      toolName = "adjust_tags_preview"
      toolOutput = await createAdjustTagsTool(
        userId,
        message,
        confirmationKey,
        resolvedTaskContext ?? undefined,
      ).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "reorganize") {
      toolName = "reorganize_preview"
      toolOutput = await createReorganizeTool(userId).execute({})
      toolHistoryContent = toolOutput
    } else if (intent.object === "task_completion") {
      const result = await handleTaskCompletion({
        message,
        intent,
        trace,
        history,
        sessionState,
        userId,
        confirmationKey,
        contextResolver: this.contextResolver,
        savePendingState: this.config.savePendingState,
      })
      if (result !== "delegate") return result
      // result === "delegate" → fall through to null
    } else if (intent.object === "planning") {
      toolName = "run_planner"
      toolOutput = await createRunPlannerTool(userId, message).execute({})
      toolHistoryContent = toolOutput
    }

    if (!toolName && !toolOutput) {
      return null
    }

    return {
      content: toolOutput ? parseToolResult(toolOutput).summary : "",
      toolName,
      toolOutput,
      toolHistoryContent: toolHistoryContent ?? toolOutput,
      intent,
      trace,
    }
  }
}

/**
 * DirectExecutorAdapter — bridges DirectExecutor → BaseDirectExecutor<AgentIntentObject>
 *
 * The new AgentOrchestrator expects BaseDirectExecutor instances in its directExecutors array.
 * This adapter wraps the existing DirectExecutor (which has rich context-fetching logic)
 * and bridges its output to OrchestrationResult.
 *
 * Session history and state are fetched from the provided stores so that
 * context-dependent intents (recall, contextual classification) work correctly.
 */
// Intent types that DirectExecutor can handle directly (excludes "unknown" which delegates to NaruAgent)
const HIGH_CONFIDENCE_INTENTS: ReadonlySet<AgentIntentObject> = new Set<AgentIntentObject>([
  "today_focus",
  "completed_today",
  "calendar_query",
  "calendar_task_link",
  "task_capture",
  "classification",
  "reorganize",
  "task_completion",
  "planning",
  "greeting",
  "recall_last_item",
  "recall_task_code",
  // FIX-2: bare 記 short-circuit (user sent only 記, needs prompt to provide content)
  "short_record",
])

export class DirectExecutorAdapter implements BaseDirectExecutor<AgentIntentObject> {
  readonly name = "zentropy_direct"

  constructor(
    private readonly config: DirectExecutorConfig,
    private readonly sessionStore: {
      get(sessionId: string): Promise<ModelMessage[] | null>
      save(sessionId: string, history: ModelMessage[]): Promise<void>
    },
    private readonly sessionStateStore?: {
      get(sessionId: string): Promise<AgentSessionState | null>
      save(sessionId: string, updater: (current: AgentSessionState) => AgentSessionState): Promise<void>
    },
    private readonly intentResolverAdapter?: {
      getLastTrace(): AgentDecisionTrace | null
    },
  ) {}

  canHandle(intent: OrchestratorIntent<AgentIntentObject>): boolean {
    return HIGH_CONFIDENCE_INTENTS.has(intent.object)
  }

  async execute(input: {
    message: string
    intent: OrchestratorIntent<AgentIntentObject>
    options?: Record<string, unknown>
  }): Promise<OrchestrationResult | null> {
    const { message, intent: orchIntent, options } = input
    const sessionId = typeof options?.sessionId === "string" ? options.sessionId : "default"

    // Build the AgentIntent and AgentDecisionTrace from orchestration intent + adapter trace
    const agentIntent: AgentIntent = {
      object: orchIntent.object,
      confidence: orchIntent.confidence,
      requiresConfirmation: orchIntent.requiresConfirmation ?? false,
    }
    const trace: AgentDecisionTrace = this.intentResolverAdapter?.getLastTrace() ?? {
      routeSource: "intent_resolver",
      resolver: "direct_executor_adapter",
      rawMessage: message,
      resolvedIntent: agentIntent,
      metadata: { reasonCodes: ["adapter_fallback"] },
      selectedTool: null,
      targetQuery: null,
    }

    // Fetch session context (history + state) for context-dependent intents
    const [history, sessionState] = await Promise.all([
      this.sessionStore.get(sessionId).then((h) => h ?? []),
      this.sessionStateStore
        ? this.sessionStateStore.get(sessionId).then((s) => s ?? { lastPresentedEntities: [], lastRecordedEntities: [] })
        : Promise.resolve({ lastPresentedEntities: [], lastRecordedEntities: [] } as AgentSessionState),
    ])

    const directExecutor = new DirectExecutor(this.config)
    const directResult = await directExecutor.tryExecute({
      message,
      intent: agentIntent,
      trace,
      history,
      sessionState,
    })

    if (directResult === null) return null

    const toolName = directResult.toolName
    const toolOutput = directResult.toolOutput
    // toolHistoryContent is the full tool output (includes [FACTS] block);
    // toolOutput from DirectExecutor is already the summary extracted from it.
    // Parse toolHistoryContent to access facts for session state updates.
    const rawToolOutput = directResult.toolHistoryContent ?? toolOutput
    const parsedResult = rawToolOutput ? parseToolResult(rawToolOutput) : null
    const content = toolOutput
      ? parseToolResult(toolOutput).summary
      : directResult.content

    // Carry our AgentDecisionTrace in result.trace via duck typing
    // LifecycleAwareAgent reads trace.resolvedIntent for turn logging
    const resultTrace = {
      ...directResult.trace,
      selectedTool: toolName ?? directResult.trace.selectedTool,
    }

    // BLOCK 2: Persist session history after direct execution
    // The new AgentOrchestrator only writes history on the delegate route.
    // For direct routes we must append user message + assistant response ourselves.
    const updatedHistory: ModelMessage[] = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content },
    ]
    await this.sessionStore.save(sessionId, updatedHistory)

    // BLOCK 3: Persist AgentSessionState (lastPresentedEntities / lastRecordedEntities)
    // after direct execution so that recall_last_item / recall_task_code see fresh data.
    if (this.sessionStateStore && parsedResult?.facts) {
      const { facts } = parsedResult

      const newPresented = extractPresentedEntities(facts)
      const rawRecorded = facts.recordedItems
      const newRecorded: PresentedEntity[] = Array.isArray(rawRecorded)
        ? (rawRecorded as Array<Record<string, unknown>>)
            .map((item, index) => ({
              position: typeof item.position === "number" ? item.position : index + 1,
              title: typeof item.title === "string" ? item.title.trim() : "",
              taskId: typeof item.taskId === "string" ? item.taskId : undefined,
              entityType: typeof item.sourceType === "string" ? item.sourceType : undefined,
            }))
            .filter((item) => item.title !== "")
        : []

      if (newPresented.length > 0 || newRecorded.length > 0) {
        await this.sessionStateStore.save(sessionId, (current) => ({
          lastPresentedEntities: newPresented.length > 0 ? newPresented : current.lastPresentedEntities,
          lastRecordedEntities: newRecorded.length > 0 ? newRecorded : current.lastRecordedEntities,
        }))
      }
    }

    const result: OrchestrationResult = {
      blocked: false,
      content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      intent: null,
      toolCalls: toolName ? [toolName] : [],
      timings: {},
      sessionId,
      traceId: null,
      // Store our AgentDecisionTrace here — LifecycleAwareAgent reads trace.resolvedIntent
      trace: resultTrace as unknown as OrchestrationResult["trace"],
      decisionTrace: {
        traceId: "",
        phaseReached: "direct_execution",
        intentResolved: orchIntent,
        timings: { total: 0 },
        directExecutorUsed: this.name,
        delegateUsed: null,
      },
      pendingConfirmation: null,
      orchestrationIntent: orchIntent,
    }
    // Attach toolOutputs for LINE interactive reply (disambiguation, confirmation)
    // Duck-typed: OrchestrationResult doesn't declare this field, but LifecycleAwareAgent passes it through
    ;(result as unknown as Record<string, unknown>).toolOutputs = rawToolOutput ? [rawToolOutput] : []
    return result
  }
}
