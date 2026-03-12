import type { ChatOptions } from "naru-agent-js"
import { AgentSessionLifecycleService } from "@/application/services/agent-session-lifecycle-service"
import { verifyAgentExecutionResult } from "./agent-execution-verifier"
import type { AgentChatTurnChannel } from "./agent-chat-turn-logger"
import { AgentChatTurnLogger } from "./agent-chat-turn-logger"

export interface AgentChatDelegate {
  chat(message: string, options?: ChatOptions): Promise<any>
}

type AgentTurnStage =
  | "before_message"
  | "delegate_chat"
  | "verify_result"
  | "after_message"
  | "log_success"

interface NormalizedTurnLogPayload {
  responseText: string | null
  toolCalls: string[]
  intent: unknown
  usage: unknown
  timings: unknown
  trace: unknown
  intentSource: string | null
}

function normalizeToolCalls(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

function hasIntentObject(value: unknown): value is { object: string } {
  if (!value || typeof value !== "object") return false
  const objectValue = (value as { object?: unknown }).object
  return typeof objectValue === "string" && objectValue.trim().length > 0
}

function extractResponseText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null
  const content = (result as { content?: unknown }).content
  return typeof content === "string" ? content : null
}

function extractTrace(result: unknown): unknown {
  if (!result || typeof result !== "object") return null
  return (result as { trace?: unknown }).trace ?? null
}

function extractUsage(result: unknown): unknown {
  if (!result || typeof result !== "object") return null
  return (result as { usage?: unknown }).usage ?? null
}

function extractTimings(result: unknown): unknown {
  if (!result || typeof result !== "object") return null
  return (result as { timings?: unknown }).timings ?? null
}

function buildSyntheticIntent(
  requestText: string,
  responseText: string | null,
): { intent: Record<string, unknown>; source: string } | null {
  const trimmedRequest = requestText.trim()
  const trimmedResponse = responseText?.trim() ?? ""

  if (/^你想要我幫你記下/u.test(trimmedResponse)) {
    return {
      intent: {
        object: "pending_confirmation",
        requiresConfirmation: true,
        confidence: 0.6,
      },
      source: "response.pending_confirmation_prompt",
    }
  }

  if (/^好的，(?:已取消|沒事)/u.test(trimmedResponse)) {
    return {
      intent: {
        object: "confirmation_reject",
        requiresConfirmation: false,
        confidence: 0.6,
      },
      source: "response.confirmation_reject",
    }
  }

  if (/^(?:確認|是的|好|好的|ok|okay)$/iu.test(trimmedRequest)) {
    return {
      intent: {
        object: "confirmation_reply",
        requiresConfirmation: false,
        confidence: 0.5,
      },
      source: "request.confirmation_reply",
    }
  }

  return null
}

function normalizeTurnLogPayload(
  requestText: string,
  result: unknown,
): NormalizedTurnLogPayload {
  const responseText = extractResponseText(result)
  const trace = extractTrace(result)
  const rawIntent = result && typeof result === "object"
    ? (result as { intent?: unknown }).intent
    : null
  if (hasIntentObject(rawIntent)) {
    return {
      responseText,
      toolCalls: normalizeToolCalls((result as { toolCalls?: unknown }).toolCalls),
      intent: rawIntent,
      usage: extractUsage(result),
      timings: extractTimings(result),
      trace,
      intentSource: "result.intent",
    }
  }

  const resolvedIntent = trace && typeof trace === "object"
    ? (trace as { resolvedIntent?: unknown }).resolvedIntent
    : null
  if (hasIntentObject(resolvedIntent)) {
    return {
      responseText,
      toolCalls: normalizeToolCalls((result as { toolCalls?: unknown }).toolCalls),
      intent: resolvedIntent,
      usage: extractUsage(result),
      timings: extractTimings(result),
      trace,
      intentSource: "trace.resolvedIntent",
    }
  }

  const synthetic = buildSyntheticIntent(requestText, responseText)

  return {
    responseText,
    toolCalls: normalizeToolCalls(result && typeof result === "object"
      ? (result as { toolCalls?: unknown }).toolCalls
      : null),
    intent: synthetic?.intent ?? rawIntent ?? null,
    usage: extractUsage(result),
    timings: extractTimings(result),
    trace,
    intentSource: synthetic?.source ?? null,
  }
}

export class LifecycleAwareAgent {
  private readonly channel: AgentChatTurnChannel
  private readonly turnLogger: Pick<AgentChatTurnLogger, "log"> | null
  private readonly now: () => Date

  constructor(
    private readonly delegate: AgentChatDelegate,
    private readonly lifecycleService: AgentSessionLifecycleService,
    private readonly defaultUserId: string,
    channelOrNow: AgentChatTurnChannel | (() => Date) = "API",
    turnLoggerOrChannel: Pick<AgentChatTurnLogger, "log"> | AgentChatTurnChannel | null = new AgentChatTurnLogger(),
    now: (() => Date) = () => new Date(),
  ) {
    if (typeof channelOrNow === "function") {
      this.channel = "API"
      this.turnLogger = new AgentChatTurnLogger()
      this.now = channelOrNow
      return
    }

    this.channel = channelOrNow
    if (typeof turnLoggerOrChannel === "string") {
      this.turnLogger = new AgentChatTurnLogger()
      this.now = now
      return
    }

    this.turnLogger = turnLoggerOrChannel ?? null
    this.now = now
  }

  async chat(message: string, options: ChatOptions = {}): Promise<any> {
    const sessionId = options.sessionId ?? "default"
    const userId = options.userId ?? this.defaultUserId
    let stage: AgentTurnStage = "before_message"
    let delegateResult: any = null
    let verifiedResult: any = null

    try {
      await this.lifecycleService.beforeMessage({
        sessionId,
        userId,
        now: this.now(),
      })

      stage = "delegate_chat"
      delegateResult = await this.delegate.chat(message, {
        ...options,
        sessionId,
        userId,
      })

      stage = "verify_result"
      verifiedResult = verifyAgentExecutionResult(delegateResult)
      const normalized = normalizeTurnLogPayload(message, verifiedResult)

      stage = "after_message"
      await this.lifecycleService.afterMessage({
        sessionId,
        now: this.now(),
      })

      stage = "log_success"
      await this.logTurnSafely({
        userId,
        sessionId,
        requestText: message,
        responseText: normalized.responseText,
        toolCalls: normalized.toolCalls,
        intent: normalized.intent,
        usage: normalized.usage,
        timings: normalized.timings,
        trace: normalized.trace,
        metadata: {
          verified: true,
          errorStage: null,
          intentSource: normalized.intentSource,
        },
        status: "SUCCESS",
      })

      return verifiedResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const normalized = normalizeTurnLogPayload(message, verifiedResult ?? delegateResult)
      await this.logTurnSafely({
        userId,
        sessionId,
        requestText: message,
        responseText: normalized.responseText,
        toolCalls: normalized.toolCalls,
        intent: normalized.intent,
        usage: normalized.usage,
        timings: normalized.timings,
        trace: normalized.trace,
        metadata: {
          verified: false,
          errorStage: stage,
          intentSource: normalized.intentSource,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        status: "ERROR",
        errorMessage,
      })
      throw error
    }
  }

  private async logTurnSafely(input: {
    userId: string
    sessionId: string
    requestText: string
    responseText?: string | null
    toolCalls?: string[]
    intent?: unknown
    usage?: unknown
    timings?: unknown
    trace?: unknown
    metadata?: Record<string, unknown>
    status: "SUCCESS" | "ERROR"
    errorMessage?: string | null
  }): Promise<void> {
    if (!this.turnLogger) return
    try {
      await this.turnLogger.log({
        userId: input.userId,
        channel: this.channel,
        sessionId: input.sessionId,
        requestText: input.requestText,
        responseText: input.responseText ?? null,
        toolCalls: input.toolCalls,
        intent: input.intent,
        usage: input.usage,
        timings: input.timings,
        trace: input.trace,
        metadata: input.metadata,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
      })
    } catch (logError) {
      console.error("[agent-turn-log] Failed to persist chat turn:", logError)
    }
  }
}
