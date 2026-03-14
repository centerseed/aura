/**
 * LineAdapter — LINE channel 實作
 *
 * 職責：
 * - 將 LINE text/postback event 解析為 ChannelMessage
 * - 將 AgentReply 格式化為 LINE messages
 * - 管理 LINE pending session 狀態（line_pending_states DB）
 * - LINE signature 驗證
 * - LINE flex message 構建（confirmation UI）
 */

import type { ChannelAdapter, ChannelMessage, AgentReply } from "./channel-adapter"
import { getLineSession, saveLineSession, clearLineSession } from "@/lib/line-session"
import type { LineSessionType, LineSessionPayload } from "@/lib/line-session"
import type { BasePendingStateManager, PendingState } from "@centerseedwu/naru-agent"

const VALID_LINE_SESSION_TYPES: ReadonlySet<LineSessionType> = new Set([
  "adjust_tags_preview",
  "complete_task_confirm",
  "complete_task_disambiguation",
  "brain_dump_pending",
])

function isLineSessionType(value: string): value is LineSessionType {
  return VALID_LINE_SESSION_TYPES.has(value as LineSessionType)
}

export interface LineRawTextInput {
  type: "text"
  text: string
  lineUserId: string
  userId: string
}

export interface LineRawPostbackInput {
  type: "postback"
  data: string
  lineUserId: string
  userId: string
}

export type LineRawInput = LineRawTextInput | LineRawPostbackInput

export interface LineRawOutput {
  messages: Array<{ type: string; text?: string; [key: string]: unknown }>
}

export class LineAdapter implements ChannelAdapter<LineRawInput, LineRawOutput> {
  parseIncoming(input: LineRawInput): ChannelMessage {
    const text = input.type === "text" ? input.text : input.data

    return {
      text: text.trim(),
      userId: input.userId,
      sessionId: input.lineUserId,
      channel: "LINE",
      metadata: {
        lineUserId: input.lineUserId,
        eventType: input.type,
        ...(input.type === "postback" ? { postbackData: input.data } : {}),
      },
    }
  }

  formatOutgoing(reply: AgentReply): LineRawOutput {
    return {
      messages: [{ type: "text", text: reply.content }],
    }
  }

  async loadPendingState(
    sessionId: string,
  ): Promise<{ type: string; payload: unknown } | null> {
    const session = await getLineSession(sessionId)
    if (!session) return null
    return { type: session.type, payload: session.payload }
  }

  async savePendingState(
    sessionId: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    if (!isLineSessionType(type)) {
      console.warn(JSON.stringify({
        event: "line_adapter_unknown_pending_type",
        type,
        sessionId,
      }))
      return
    }
    await saveLineSession(
      sessionId,
      type,
      payload as LineSessionPayload,
    )
  }

  async clearPendingState(sessionId: string): Promise<void> {
    await clearLineSession(sessionId)
  }
}

/**
 * LinePendingStateManager — adapts LineAdapter's pending state methods to
 * the BasePendingStateManager interface required by the new AgentOrchestrator.
 *
 * Key design: always uses `confirmationKey` (LINE userId or api:{userId}) as
 * the actual storage key, regardless of the `sessionId` argument passed by
 * the orchestrator. This preserves the existing LINE pending session semantics.
 */
export class LinePendingStateManager implements BasePendingStateManager {
  private readonly adapter: LineAdapter

  constructor(
    /** The actual storage key (LINE userId or api:{userId}) */
    private readonly confirmationKey: string,
  ) {
    this.adapter = new LineAdapter()
  }

  async getPending(_sessionId: string): Promise<PendingState | null> {
    const state = await this.adapter.loadPendingState(this.confirmationKey)
    if (!state) return null
    return {
      type: state.type,
      payload: state.payload as Record<string, unknown>,
      createdAt: Date.now(),
    }
  }

  async setPending(_sessionId: string, state: PendingState): Promise<void> {
    await this.adapter.savePendingState(this.confirmationKey, state.type, state.payload)
  }

  async clearPending(_sessionId: string): Promise<void> {
    await this.adapter.clearPendingState(this.confirmationKey)
  }
}
