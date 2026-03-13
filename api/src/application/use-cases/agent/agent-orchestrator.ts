/**
 * AgentOrchestrator — 取代 ToolFirstAgent 的核心協調器
 *
 * 流程：check pending → resolve intent → try direct execution → delegate to NaruAgent
 *
 * 本模組不知道任何 channel 細節，只接受 ChannelMessage，回傳 AgentOrchestratorResult。
 */

import type { ModelMessage } from "ai"
import type { ChatOptions, MemoryManager } from "naru-agent-js"
import type { SessionMetaStore } from "@/application/services/agent-session-lifecycle-service"
import { AgentSessionStateStore, type AgentSessionState } from "./agent-session-state"
import { IntentRouter } from "./intent-router"
import { ContextResolver, extractRecordedItems, extractLatestPresentedEntities } from "./context-resolver"
import { DirectExecutor } from "./direct-executor"
import {
  extractPresentedEntities,
  parseToolResult,
} from "./tool-result-protocol"
import { normalizeAgentUsage } from "./llm-logging"
import type { AgentIntentResolver } from "./agent-intent-resolver"
import {
  extractBrainDumpConfirmationTarget,
  classifyConfirmationDisposition,
} from "@/lib/line-confirmation"
import type { AdjustTagsPayload, BrainDumpPendingPayload, CompleteTaskPayload } from "@/lib/line-session"
import { ExecuteAdjustmentUseCase } from "@/application/use-cases/adjust-tags/execute-adjustment"
import { executeCompleteTaskPayload, buildCompleteTaskSuccessMessage } from "./complete-task-executor"
import { createBrainDumpTool } from "./brain-dump-skill"
import type { AgentIntent, AgentDecisionTrace } from "./agent-intent"

const SHORT_RECORD_PATTERN = /^記$/

interface AgentChatResult {
  blocked: boolean
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  intent: AgentIntent | null
  toolCalls: string[]
  toolOutputs?: string[]
  timings: Record<string, number>
  sessionId: string | null
  traceId: string | null
  trace: AgentDecisionTrace | null
  pendingConfirmation?: {
    type: string
    payload: unknown
  }
}

interface SessionStoreLike {
  get(sessionId: string): Promise<ModelMessage[] | null>
  save(sessionId: string, history: ModelMessage[]): Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DelegateResult = Record<string, any> & { content: string }

interface AgentChatDelegate {
  chat(message: string, options?: ChatOptions): Promise<DelegateResult>
}

export interface PendingStateProvider {
  load(sessionId: string): Promise<{ type: string; payload: unknown } | null>
  save(sessionId: string, type: string, payload: unknown): Promise<void>
  clear(sessionId: string): Promise<void>
}

export interface AgentOrchestratorConfig {
  delegate: AgentChatDelegate
  sessionStore: SessionStoreLike
  metaStore?: SessionMetaStore
  memoryManager?: MemoryManager | null
  /** LINE confirmation key（有則啟用 LINE pending session 機制） */
  confirmationKey?: string
  intentResolver?: AgentIntentResolver
  /** Channel-neutral pending state provider（取代直接呼叫 saveLineSession） */
  pendingStateProvider?: PendingStateProvider
}

interface PhaseTimings {
  session_history_load_ms?: number
  intent_resolve_ms?: number
  direct_route_ms?: number
  delegate_chat_ms?: number
  delegate_history_check_ms?: number
  delegate_history_fallback_persist_ms?: number
  [key: string]: number | undefined
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

export class AgentOrchestrator {
  private readonly intentRouter: IntentRouter
  private readonly agentSessionStateStore?: AgentSessionStateStore

  constructor(private readonly config: AgentOrchestratorConfig) {
    this.intentRouter = new IntentRouter({
      intentResolver: config.intentResolver,
    })
    this.agentSessionStateStore = config.metaStore
      ? new AgentSessionStateStore(config.metaStore)
      : undefined
  }

  async chat(message: string, options: ChatOptions = {}): Promise<AgentChatResult> {
    const sessionId = options.sessionId ?? "default"
    const userId = options.userId
    const trimmedMessage = message.trim()
    const startedAt = Date.now()
    const phaseTimings: PhaseTimings = {}

    const finish = (
      result: AgentChatResult,
      route: "short_circuit" | "direct_tool" | "delegate",
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
      }
      const timings = {
        ...phaseTimings,
        ...result.timings,
        total_ms: Date.now() - startedAt,
      }
      const intentObject = extractIntentObject(result.intent)
      console.log(JSON.stringify({
        event: "agent_orchestrator_chat_complete",
        sessionId,
        userId,
        route,
        message_len: trimmedMessage.length,
        intent_object: intentObject,
        toolCalls: result.toolCalls,
        timings,
        usage,
      }))
      return { ...result, timings }
    }

    try {
      // ── Phase 0: check pending confirmation ─────────────────────────────
      if (this.config.pendingStateProvider) {
        const pendingResult = await this.handlePendingConfirmation({
          message: trimmedMessage,
          sessionId,
          userId,
        })
        if (pendingResult !== null) {
          return finish(pendingResult, "direct_tool")
        }
      }

      // Ultra-short pattern: no intent resolution needed
      if (SHORT_RECORD_PATTERN.test(trimmedMessage)) {
        const result = await this.buildDirectResult({
          sessionId,
          message: trimmedMessage,
          content: "請直接告訴我要記錄的內容，例如任務名稱、待辦事項或想法。",
          intent: null,
          trace: null,
        })
        return finish(result, "short_circuit")
      }

      const historyStartedAt = Date.now()
      const [history, sessionState] = await Promise.all([
        this.config.sessionStore.get(sessionId).then((h) => h ?? []),
        this.agentSessionStateStore
          ? this.agentSessionStateStore.get(sessionId)
          : Promise.resolve<AgentSessionState>({ lastPresentedEntities: [], lastRecordedEntities: [] }),
      ])
      phaseTimings.session_history_load_ms = Date.now() - historyStartedAt

      const resolveStartedAt = Date.now()
      const { intent, trace } = await this.intentRouter.resolve({
        message: trimmedMessage,
        history,
        sessionId,
        userId,
        sessionState,
      })
      phaseTimings.intent_resolve_ms = Date.now() - resolveStartedAt

      // Create per-call DirectExecutor with the current userId
      const directExecutor = new DirectExecutor({
        userId: userId ?? "",
        confirmationKey: this.config.confirmationKey,
        savePendingState: this.config.pendingStateProvider
          ? (sid, type, payload) => this.config.pendingStateProvider!.save(sid, type, payload)
          : undefined,
      })

      const directStartedAt = Date.now()
      const directResult = await directExecutor.tryExecute({
        message: trimmedMessage,
        intent,
        trace,
        history,
        sessionState,
      })
      phaseTimings.direct_route_ms = Date.now() - directStartedAt

      if (directResult !== null) {
        const toolName = directResult.toolName
        const toolOutput = directResult.toolOutput
        const toolHistoryContent = directResult.toolHistoryContent ?? toolOutput

        if (toolOutput) {
          // Has a tool call — persist and return
          trace.selectedTool = toolName ?? trace.selectedTool
          await Promise.all([
            appendSessionHistory(
              this.config.sessionStore, sessionId, trimmedMessage, toolHistoryContent ?? "",
            ),
            this.persistCanonicalSessionState(sessionId, toolHistoryContent ?? ""),
            appendLongTermMemory(
              this.config.memoryManager, userId, trimmedMessage, toolHistoryContent ?? "",
            ),
          ])
          const result: AgentChatResult = {
            blocked: false,
            content: parseToolResult(toolOutput).summary,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            intent,
            toolCalls: toolName ? [toolName] : [],
            toolOutputs: [toolOutput],
            timings: {},
            sessionId,
            traceId: null,
            trace,
          }
          return finish(result, "direct_tool")
        } else {
          // No tool output — direct text response (greeting, recall, clarification)
          const result = await this.buildDirectResult({
            sessionId,
            message: trimmedMessage,
            content: directResult.content,
            intent,
            trace,
          })
          return finish(result, "direct_tool")
        }
      }

      // Delegate to NaruAgent
      const delegateStartedAt = Date.now()
      const delegateResult = await this.config.delegate.chat(message, options)
      phaseTimings.delegate_chat_ms = Date.now() - delegateStartedAt

      // Always persist session after delegate (orchestrator owns persistence)
      const fallbackPersistStartedAt = Date.now()
      await appendSessionHistory(
        this.config.sessionStore, sessionId, trimmedMessage, delegateResult.content,
      )
      phaseTimings.delegate_history_fallback_persist_ms = Date.now() - fallbackPersistStartedAt

      let pendingConfirmation: AgentChatResult["pendingConfirmation"] | undefined
      const pendingBrainDumpTarget = extractBrainDumpConfirmationTarget(delegateResult.content)
      if (pendingBrainDumpTarget) {
        const brainDumpPayload = {
          originalText: pendingBrainDumpTarget,
          taskTitle: pendingBrainDumpTarget,
        }
        pendingConfirmation = { type: "brain_dump_pending", payload: brainDumpPayload }
        if (this.config.pendingStateProvider && this.config.confirmationKey) {
          await this.config.pendingStateProvider.save(
            this.config.confirmationKey,
            "brain_dump_pending",
            brainDumpPayload,
          )
        }
      }

      return finish({ ...delegateResult, pendingConfirmation } as AgentChatResult, "delegate")
    } catch (error) {
      console.error(JSON.stringify({
        event: "agent_orchestrator_chat_error",
        sessionId,
        userId,
        message_len: trimmedMessage.length,
        timings: { ...phaseTimings, total_ms: Date.now() - startedAt },
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
  }

  private async persistCanonicalSessionState(
    sessionId: string,
    rawToolOutput: string,
  ): Promise<void> {
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

  /**
   * Phase 0: If a pending confirmation state exists, handle confirm/reject/override.
   * Returns an AgentChatResult if the pending was handled, or null to continue normal flow.
   */
  private async handlePendingConfirmation(input: {
    message: string
    sessionId: string
    userId: string | undefined
  }): Promise<AgentChatResult | null> {
    const { message, sessionId, userId } = input
    const provider = this.config.pendingStateProvider!
    // Pending state is keyed by confirmationKey (LINE user ID or "api:{userId}"),
    // NOT sessionId — these differ in non-LINE contexts (e.g. API, v2 test script)
    const stateKey = this.config.confirmationKey ?? sessionId
    const pendingState = await provider.load(stateKey)
    if (!pendingState) return null

    const disposition = classifyConfirmationDisposition(message)

    if (disposition === "reject") {
      await provider.clear(stateKey)
      return this.buildDirectResult({
        sessionId,
        message,
        content: "好的，已取消。",
        intent: null,
        trace: null,
      })
    }

    if (disposition === "override") {
      await provider.clear(stateKey)
      return null // continue to normal agent flow
    }

    // disposition === "confirm" → execute pending operation
    if (pendingState.type === "adjust_tags_preview") {
      const p = pendingState.payload as AdjustTagsPayload
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
      await provider.clear(stateKey)
      const summary = result.operationLog.join("\n")
      const content = `✅ 已完成分類調整：\n\n${summary}`
      return this.buildDirectResult({
        sessionId,
        message,
        content,
        toolName: "adjust_tags_preview",
        toolOutput: content,
        intent: null,
        trace: null,
      })
    }

    if (pendingState.type === "complete_task_confirm") {
      const p = pendingState.payload as CompleteTaskPayload
      try {
        await executeCompleteTaskPayload(userId ?? "", p)
      } catch {
        await provider.clear(stateKey)
        return this.buildDirectResult({
          sessionId,
          message,
          content: "發生錯誤：無法識別要完成的任務。",
          intent: null,
          trace: null,
        })
      }
      await provider.clear(stateKey)
      const successMessage = buildCompleteTaskSuccessMessage(p.taskTitle)
      return this.buildDirectResult({
        sessionId,
        message,
        content: successMessage,
        toolName: "complete_task_search",
        toolOutput: successMessage,
        intent: null,
        trace: null,
      })
    }

    if (pendingState.type === "brain_dump_pending") {
      const p = pendingState.payload as BrainDumpPendingPayload
      const toolOutput = await createBrainDumpTool(userId ?? "", p.originalText).execute({})
      await provider.clear(stateKey)
      return this.buildDirectResult({
        sessionId,
        message,
        content: parseToolResult(toolOutput).summary,
        toolName: "brain_dump",
        toolOutput,
        intent: null,
        trace: null,
      })
    }

    // Unknown pending type — clear and continue
    await provider.clear(stateKey)
    return null
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
    intent?: AgentIntent | null
    trace?: AgentDecisionTrace | null
    toolName?: string
    toolOutput?: string
  }): Promise<AgentChatResult> {
    await appendSessionHistory(this.config.sessionStore, sessionId, message, content)

    return {
      blocked: false,
      content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
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
