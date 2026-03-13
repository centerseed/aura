/**
 * DirectExecutor — 高信心度直接工具執行模組
 *
 * 職責：對於有高信心度 intent 的訊息，直接呼叫對應工具，跳過 LLM delegate。
 * 邏輯從 ToolFirstAgent.tryDirectToolRoute 原封搬出。
 *
 * 回傳 null 表示需要 delegate（LLM 路由）。
 */

import type { ModelMessage } from "ai"
import { createBrainDumpTool } from "./brain-dump-skill"
import { createAdjustTagsTool } from "./adjust-tags-skill"
import { createReorganizeTool } from "./reorganize-skill"
import { createQueryCompletedTodayTasksTool, createQueryTodayTasksTool } from "./query-tasks-skill"
import { shouldUseStrictTodayFocus } from "./today-focus-scope"
import { serializeFactsSummary, parseToolResult } from "./tool-result-protocol"
import { createRunPlannerTool } from "./planner-skill"
import { createQueryCalendarTool } from "./query-calendar-skill"
import { toCalendarUnavailableMessage } from "./agent-calendar-query-service"
import { createTaskFromCalendarEvent } from "./create-task-from-calendar-event"
import type { AgentIntent, AgentDecisionTrace } from "./agent-intent"
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
