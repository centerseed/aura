import type { ChatOptions } from "naru-agent-js"
import { AgentSessionLifecycleService } from "@/application/services/agent-session-lifecycle-service"
import { verifyAgentExecutionResult } from "./agent-execution-verifier"
import type { AgentChatTurnChannel } from "./agent-chat-turn-logger"
import { AgentChatTurnLogger } from "./agent-chat-turn-logger"

export interface AgentChatDelegate {
  chat(message: string, options?: ChatOptions): Promise<any>
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
    let responseText: string | null = null
    let verifiedResult: any = null

    await this.lifecycleService.beforeMessage({
      sessionId,
      userId,
      now: this.now(),
    })

    try {
      const result = await this.delegate.chat(message, {
        ...options,
        sessionId,
        userId,
      })

      verifiedResult = verifyAgentExecutionResult(result)
      responseText = typeof verifiedResult?.content === "string"
        ? verifiedResult.content
        : null

      await this.lifecycleService.afterMessage({
        sessionId,
        now: this.now(),
      })

      await this.logTurnSafely({
        userId,
        sessionId,
        requestText: message,
        responseText,
        toolCalls: Array.isArray(verifiedResult?.toolCalls) ? verifiedResult.toolCalls : [],
        intent: verifiedResult?.intent,
        usage: verifiedResult?.usage,
        timings: verifiedResult?.timings,
        trace: verifiedResult?.trace,
        metadata: {
          verified: true,
        },
        status: "SUCCESS",
      })

      return verifiedResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.logTurnSafely({
        userId,
        sessionId,
        requestText: message,
        responseText,
        toolCalls: Array.isArray(verifiedResult?.toolCalls) ? verifiedResult.toolCalls : [],
        intent: verifiedResult?.intent,
        usage: verifiedResult?.usage,
        timings: verifiedResult?.timings,
        trace: verifiedResult?.trace,
        metadata: {
          verified: false,
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
