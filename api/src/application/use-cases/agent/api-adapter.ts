/**
 * ApiAdapter — API channel 實作
 *
 * 職責：
 * - 將 POST /api/agent `{ message, session_id }` 解析為 ChannelMessage
 * - 將 AgentReply 格式化為 `{ reply, tool_calls, usage }`
 * - pending state 用 in-memory map（API 無跨請求 session pending）
 */

import type { ChannelAdapter, ChannelMessage, AgentReply } from "./channel-adapter"

export interface ApiRawInput {
  message: string
  session_id?: string
  userId: string
}

export interface ApiRawOutput {
  reply: string
  tool_calls: string[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class ApiAdapter implements ChannelAdapter<ApiRawInput, ApiRawOutput> {
  private readonly pendingState = new Map<string, { type: string; payload: unknown }>()

  parseIncoming(input: ApiRawInput): ChannelMessage {
    return {
      text: input.message.trim(),
      userId: input.userId,
      sessionId: input.session_id ?? "default",
      channel: "API",
      metadata: {},
    }
  }

  formatOutgoing(reply: AgentReply): ApiRawOutput {
    return {
      reply: reply.content,
      tool_calls: reply.toolCalls,
      usage: reply.usage,
    }
  }

  async loadPendingState(sessionId: string): Promise<{ type: string; payload: unknown } | null> {
    return this.pendingState.get(sessionId) ?? null
  }

  async savePendingState(sessionId: string, type: string, payload: unknown): Promise<void> {
    this.pendingState.set(sessionId, { type, payload })
  }

  async clearPendingState(sessionId: string): Promise<void> {
    this.pendingState.delete(sessionId)
  }
}
