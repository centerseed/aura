import type { BackendApiClient } from "../backend-client/api-client"
import type { AuthContext } from "../types"

export interface ListAgentChatTurnsInput {
  channel?: "API" | "LINE"
  status?: "SUCCESS" | "ERROR"
  session_id?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

interface RawAgentChatTurn {
  id: string
  channel: "API" | "LINE"
  session_id: string
  request_text: string
  response_text: string | null
  tool_calls?: string[]
  status: "SUCCESS" | "ERROR"
  error_message?: string | null
  intent_object?: string | null
  usage?: unknown
  timings?: unknown
  created_at: string
}

export async function handleListAgentChatTurns(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as ListAgentChatTurnsInput

  const data = await apiClient.getAgentChatTurns(authContext.userId, {
    channel: params.channel,
    status: params.status,
    session_id: params.session_id,
    from: params.from,
    to: params.to,
    limit: params.limit,
    offset: params.offset,
  }) as {
    total?: number
    limit?: number
    offset?: number
    items?: RawAgentChatTurn[]
  }

  const items = Array.isArray(data?.items) ? data.items : []

  return {
    total: typeof data?.total === "number" ? data.total : items.length,
    limit: typeof data?.limit === "number" ? data.limit : (params.limit ?? items.length),
    offset: typeof data?.offset === "number" ? data.offset : (params.offset ?? 0),
    items: items.map((item) => ({
      id: item.id,
      channel: item.channel,
      session_id: item.session_id,
      request_text: item.request_text,
      response_text: item.response_text,
      tool_calls: Array.isArray(item.tool_calls) ? item.tool_calls : [],
      status: item.status,
      error_message: item.error_message ?? null,
      intent_object: item.intent_object ?? null,
      usage: item.usage ?? null,
      timings: item.timings ?? null,
      created_at: item.created_at,
    })),
  }
}
