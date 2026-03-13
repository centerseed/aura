/**
 * ChannelAdapter — 統一訊息介面 + Channel Adapter 抽象
 *
 * ChannelMessage: 任何 channel 進來的訊息，統一轉換成此格式
 * ChannelAdapter: 每個 channel（LINE、API、...）實作此介面
 */

export interface ChannelMessage {
  /** 使用者輸入的純文字 */
  text: string
  /** 系統內部 userId（已綁定帳號的 DB 主鍵） */
  userId: string
  /** session 識別符（LINE 用 lineUserId，API 用 session_id） */
  sessionId: string
  /** 來源 channel 名稱 */
  channel: "LINE" | "API"
  /** Channel-specific 附加資料（postback payload、原始 event type 等） */
  metadata?: Record<string, unknown>
}

export interface AgentReply {
  /** Agent 回覆文字 */
  content: string
  /** 本次呼叫到的工具名稱列表 */
  toolCalls: string[]
  /** 工具原始輸出（供 LINE interactive reply 解析） */
  toolOutputs?: string[]
  /** Token 用量 */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** 是否有待確認的操作（pendingConfirmation） */
  pendingConfirmation?: {
    type: string
    payload: unknown
  }
}

/**
 * ChannelAdapter — 每個 channel 必須實作此介面
 *
 * 負責：
 * - 解析 channel-specific 原始輸入 → ChannelMessage
 * - 格式化 AgentReply → channel-specific 輸出格式
 * - 管理 pending session 狀態（需要確認的操作）
 */
export interface ChannelAdapter<TRawInput = unknown, TRawOutput = unknown> {
  /**
   * 將 channel-specific 原始輸入解析為統一 ChannelMessage
   */
  parseIncoming(input: TRawInput): Promise<ChannelMessage> | ChannelMessage

  /**
   * 將 AgentReply 格式化為 channel-specific 輸出格式
   */
  formatOutgoing(reply: AgentReply): Promise<TRawOutput> | TRawOutput

  /**
   * 送出確認請求給用戶（LINE flex message、API JSON preview 等）
   */
  sendConfirmation?(sessionId: string, confirmationType: string, payload: unknown): Promise<void>

  /**
   * 載入 pending session 狀態
   */
  loadPendingState(sessionId: string): Promise<{ type: string; payload: unknown } | null>

  /**
   * 儲存 pending session 狀態
   */
  savePendingState(sessionId: string, type: string, payload: unknown): Promise<void>

  /**
   * 清除 pending session 狀態
   */
  clearPendingState(sessionId: string): Promise<void>
}
