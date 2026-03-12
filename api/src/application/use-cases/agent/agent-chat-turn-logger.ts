import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export type AgentChatTurnChannel = "API" | "LINE"
export type AgentChatTurnStatus = "SUCCESS" | "ERROR"

export interface AgentChatTurnLogInput {
  userId: string
  channel: AgentChatTurnChannel
  sessionId: string
  requestText: string
  responseText?: string | null
  toolCalls?: string[]
  intent?: unknown
  usage?: unknown
  timings?: unknown
  trace?: unknown
  metadata?: Record<string, unknown>
  status: AgentChatTurnStatus
  errorMessage?: string | null
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export class AgentChatTurnLogger {
  async log(input: AgentChatTurnLogInput): Promise<void> {
    await prisma.agentChatTurn.create({
      data: {
        user_id: input.userId,
        channel: input.channel,
        session_id: input.sessionId,
        request_text: input.requestText,
        response_text: input.responseText ?? null,
        tool_calls: input.toolCalls ?? [],
        intent: toJsonValue(input.intent),
        usage: toJsonValue(input.usage),
        timings: toJsonValue(input.timings),
        trace: toJsonValue(input.trace),
        metadata: toJsonValue(input.metadata),
        status: input.status,
        error_message: input.errorMessage ?? null,
      },
    })
  }
}
