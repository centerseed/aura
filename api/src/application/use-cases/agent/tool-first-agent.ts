import type { ModelMessage } from "ai"
import type { MemoryManager } from "naru-agent-js"
import type { ChatOptions } from "naru-agent-js"
import { createBrainDumpTool, shouldActivateBrainDump } from "./brain-dump-skill"
import { createAdjustTagsTool } from "./adjust-tags-skill"
import { createCompleteTaskSearchTool } from "./complete-task-skill"
import { createReorganizeTool } from "./reorganize-skill"
import { createQueryCompletedTodayTasksTool, createQueryTodayTasksTool } from "./query-tasks-skill"

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
}

const QUERY_COMPLETED_TODAY_PATTERN = /今天.*完成|完成.*今天|完成了什麼|做了什麼/i
const QUERY_TODAY_PATTERN = /今天.*(有哪些|有什麼|要做什麼|任務|待辦)|(?:有哪些|有什麼).*(?:任務|待辦)|(?:查詢|列出|顯示).*(?:任務|待辦)|還剩什麼|剩下什麼/i
const ADJUST_TAGS_PATTERN = /移到|改到|改成|分錯了|應該在|換到|分類錯了|移進|歸到|放在|不是/i
const COMPLETE_TASK_PATTERN = /完成|做完|搞定|done|完成了|已完成|做好了|結束了/i
const REORGANIZE_PATTERN = /整理|重組|歸類|清理|亂掉了|太多任務|整頓|幫我整理/i
const GREETING_PATTERN = /你好|你是誰|可以做什麼/i
const PLANNER_PATTERN = /規劃|拆解|展開/i
const RECALL_LAST_ITEM_PATTERN = /我剛才記了什麼/i
const RECALL_TASK_CODE_PATTERN = /任務代號是什麼|只回答代號/i
const SHORT_RECORD_PATTERN = /^記$/

function extractToolSummary(raw: string): string {
  const marker = "[/FACTS]"
  const markerIndex = raw.indexOf(marker)
  if (markerIndex === -1) return raw
  return raw.slice(markerIndex + marker.length).trim()
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
  constructor(private readonly config: ToolFirstAgentConfig) {}

  async chat(message: string, options: ChatOptions = {}): Promise<AgentChatResult> {
    const directResult = await this.tryDirectToolRoute(message, options)
    if (directResult) return directResult
    return this.config.delegate.chat(message, options)
  }

  private async tryDirectToolRoute(message: string, options: ChatOptions): Promise<AgentChatResult | null> {
    const sessionId = options.sessionId ?? "default"
    const userId = options.userId
    const trimmedMessage = message.trim()
    const history = (await this.config.sessionStore.get(sessionId)) ?? []

    let toolName: string | null = null
    let toolOutput: string | null = null

    if (SHORT_RECORD_PATTERN.test(trimmedMessage)) {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "請直接告訴我要記錄的內容，例如任務名稱、待辦事項或想法。",
      })
    }

    if (RECALL_TASK_CODE_PATTERN.test(trimmedMessage)) {
      const taskCode = extractLatestTaskCode(history)
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: taskCode ?? "目前找不到你剛剛提到的任務代號。",
      })
    }

    if (RECALL_LAST_ITEM_PATTERN.test(trimmedMessage)) {
      const recordedItems = extractRecordedItems(history)
      const latestItem = recordedItems.at(-1)
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: latestItem
          ? `你剛才記的是：${latestItem}`
          : "目前找不到你剛才記錄的項目。",
      })
    }

    if (GREETING_PATTERN.test(trimmedMessage)) {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "我是 Naru，也是 Zentropy 的任務助理。目前可以幫你記錄任務、查詢待辦、標記完成、整理結構與調整分類。",
      })
    }

    if (PLANNER_PATTERN.test(trimmedMessage)) {
      return this.buildDirectResult({
        sessionId,
        message: trimmedMessage,
        content: "完整規劃功能還在開發中。你可以先把目標記下來，我目前能先幫你記錄，之後再協助拆解規劃。",
      })
    }

    if (QUERY_COMPLETED_TODAY_PATTERN.test(trimmedMessage)) {
      toolName = "query_completed_today_tasks"
      toolOutput = await createQueryCompletedTodayTasksTool(userId ?? "").execute({})
      toolOutput = extractToolSummary(toolOutput)
    } else if (QUERY_TODAY_PATTERN.test(trimmedMessage)) {
      toolName = "query_today_tasks"
      toolOutput = await createQueryTodayTasksTool(userId ?? "").execute({})
      toolOutput = extractToolSummary(toolOutput)
    } else if (shouldActivateBrainDump(trimmedMessage)) {
      toolName = "brain_dump"
      toolOutput = await createBrainDumpTool(userId ?? "", trimmedMessage).execute({})
    } else if (ADJUST_TAGS_PATTERN.test(trimmedMessage)) {
      toolName = "adjust_tags_preview"
      toolOutput = await createAdjustTagsTool(userId ?? "", trimmedMessage).execute({})
    } else if (!QUERY_COMPLETED_TODAY_PATTERN.test(trimmedMessage) && COMPLETE_TASK_PATTERN.test(trimmedMessage)) {
      toolName = "complete_task_search"
      toolOutput = await createCompleteTaskSearchTool(userId ?? "", trimmedMessage).execute({})
      toolOutput = extractToolSummary(toolOutput)
    } else if (REORGANIZE_PATTERN.test(trimmedMessage)) {
      toolName = "reorganize_preview"
      toolOutput = await createReorganizeTool(userId ?? "").execute({})
    }

    if (!toolName || !toolOutput) {
      return null
    }

    // Groq 的這顆模型在 function calling 參數生成上不穩定。
    // 對於可由明確 trigger 決定的 skill，直接執行工具可保留產品行為並避免 provider-specific tool schema 問題。
    await appendSessionHistory(this.config.sessionStore, sessionId, trimmedMessage, toolOutput)
    await appendLongTermMemory(this.config.memoryManager, userId, trimmedMessage, toolOutput)

    return {
      blocked: false,
      content: toolOutput,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      intent: null,
      toolCalls: [toolName],
      timings: {},
      sessionId,
      traceId: null,
      trace: null,
    }
  }

  private async buildDirectResult({
    sessionId,
    message,
    content,
  }: {
    sessionId: string
    message: string
    content: string
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
      intent: null,
      toolCalls: [],
      timings: {},
      sessionId,
      traceId: null,
      trace: null,
    }
  }
}
