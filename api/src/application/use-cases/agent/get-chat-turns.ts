import { prisma } from "@/lib/db"
import { ValidationException } from "@/lib/api-response"

export interface GetAgentChatTurnsRequest {
  userId: string
  channel?: "API" | "LINE"
  status?: "SUCCESS" | "ERROR"
  sessionId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface AgentChatTurnItem {
  id: string
  user_id: string
  channel: "API" | "LINE"
  session_id: string
  request_text: string
  response_text: string | null
  tool_calls: string[]
  status: "SUCCESS" | "ERROR"
  error_message: string | null
  intent_object: string | null
  intent: unknown
  usage: unknown
  timings: unknown
  trace: unknown
  metadata: unknown
  created_at: Date
}

export interface GetAgentChatTurnsResponse {
  total: number
  limit: number
  offset: number
  items: AgentChatTurnItem[]
}

function parseDateBoundary(value: string | undefined, field: "from" | "to"): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationException(`${field} must be a valid ISO date`, field)
  }
  return parsed
}

export class GetAgentChatTurnsUseCase {
  async execute(request: GetAgentChatTurnsRequest): Promise<GetAgentChatTurnsResponse> {
    this.validateRequest(request)

    const limit = request.limit ?? 20
    const offset = request.offset ?? 0
    const from = parseDateBoundary(request.from, "from")
    const to = parseDateBoundary(request.to, "to")

    const where: Record<string, unknown> = {
      user_id: request.userId,
    }

    if (request.channel) where.channel = request.channel
    if (request.status) where.status = request.status
    if (request.sessionId) where.session_id = request.sessionId
    if (from || to) {
      where.created_at = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      }
    }

    const total = await prisma.agentChatTurn.count({ where })
    const turns = await prisma.agentChatTurn.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    })

    return {
      total,
      limit,
      offset,
      items: turns.map((turn) => ({
        id: turn.id,
        user_id: turn.user_id,
        channel: turn.channel,
        session_id: turn.session_id,
        request_text: turn.request_text,
        response_text: turn.response_text,
        tool_calls: Array.isArray(turn.tool_calls)
          ? turn.tool_calls.filter((value): value is string => typeof value === "string")
          : [],
        status: turn.status,
        error_message: turn.error_message,
        intent_object: this.extractIntentObject(turn.intent),
        intent: turn.intent,
        usage: turn.usage,
        timings: turn.timings,
        trace: turn.trace,
        metadata: turn.metadata,
        created_at: turn.created_at,
      })),
    }
  }

  private extractIntentObject(intent: unknown): string | null {
    if (!intent || typeof intent !== "object") return null
    const objectValue = (intent as { object?: unknown }).object
    return typeof objectValue === "string" ? objectValue : null
  }

  private validateRequest(request: GetAgentChatTurnsRequest): void {
    if (!request.userId) {
      throw new ValidationException("User ID is required", "userId")
    }

    if (request.limit !== undefined && (request.limit < 1 || request.limit > 100)) {
      throw new ValidationException("Limit must be between 1 and 100", "limit")
    }

    if (request.offset !== undefined && request.offset < 0) {
      throw new ValidationException("Offset must be non-negative", "offset")
    }

    if (request.channel && request.channel !== "API" && request.channel !== "LINE") {
      throw new ValidationException("channel must be API or LINE", "channel")
    }

    if (request.status && request.status !== "SUCCESS" && request.status !== "ERROR") {
      throw new ValidationException("status must be SUCCESS or ERROR", "status")
    }
  }
}
