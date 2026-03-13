/**
 * ConfirmationStateMachine — 通用確認流程狀態機
 *
 * 狀態轉換：IDLE → PREVIEW_SENT → AWAITING → EXECUTING → DONE
 * 本模組不知道任何 channel 細節（不知道 LINE / API），
 * channel adapter 負責 UI 呈現。
 */

export type ConfirmationState =
  | "IDLE"
  | "PREVIEW_SENT"
  | "AWAITING"
  | "EXECUTING"
  | "DONE"

export type ConfirmationEvent =
  | "preview"
  | "user_confirm"
  | "user_reject"
  | "user_override"
  | "timeout"

interface PendingEntry {
  state: ConfirmationState
  type: string
  payload: unknown
  createdAt: number
  ttlMs: number
}

const VALID_TRANSITIONS: Record<ConfirmationState, Partial<Record<ConfirmationEvent, ConfirmationState>>> = {
  IDLE: {
    preview: "PREVIEW_SENT",
  },
  PREVIEW_SENT: {
    user_confirm: "AWAITING",
    user_reject: "IDLE",
    user_override: "IDLE",
    timeout: "IDLE",
  },
  AWAITING: {
    user_confirm: "EXECUTING",
    user_reject: "IDLE",
    user_override: "IDLE",
    timeout: "IDLE",
  },
  EXECUTING: {
    // terminal → auto-clears
  },
  DONE: {
    // terminal
  },
}

export class ConfirmationStateMachine {
  private readonly pending = new Map<string, PendingEntry>()

  /**
   * 送出 preview（IDLE → PREVIEW_SENT）
   */
  preview(sessionId: string, type: string, payload: unknown, ttlMs = 10 * 60 * 1000): boolean {
    const current = this.getState(sessionId)
    const nextState = VALID_TRANSITIONS[current]?.preview
    if (!nextState) return false

    this.pending.set(sessionId, {
      state: nextState,
      type,
      payload,
      createdAt: Date.now(),
      ttlMs,
    })
    return true
  }

  /**
   * 用戶確認（PREVIEW_SENT/AWAITING → AWAITING/EXECUTING）
   */
  confirm(sessionId: string): boolean {
    return this.transition(sessionId, "user_confirm")
  }

  /**
   * 用戶拒絕（→ IDLE，清除狀態）
   */
  reject(sessionId: string): boolean {
    const success = this.transition(sessionId, "user_reject")
    if (success) this.pending.delete(sessionId)
    return success
  }

  /**
   * 用戶有新意圖覆蓋（→ IDLE，清除狀態）
   */
  override(sessionId: string): boolean {
    const success = this.transition(sessionId, "user_override")
    if (success) this.pending.delete(sessionId)
    return success
  }

  /**
   * Timeout 清除（→ IDLE，清除狀態）
   */
  timeout(sessionId: string): boolean {
    const success = this.transition(sessionId, "timeout")
    if (success) this.pending.delete(sessionId)
    return success
  }

  /**
   * 取得目前狀態（若 TTL 已過則自動清除並回 IDLE）
   */
  getState(sessionId: string): ConfirmationState {
    const entry = this.pending.get(sessionId)
    if (!entry) return "IDLE"
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.pending.delete(sessionId)
      return "IDLE"
    }
    return entry.state
  }

  /**
   * 取得 pending 資料（type + payload）
   */
  getPending(sessionId: string): { type: string; payload: unknown } | null {
    const state = this.getState(sessionId)
    if (state === "IDLE") return null
    const entry = this.pending.get(sessionId)
    if (!entry) return null
    return { type: entry.type, payload: entry.payload }
  }

  /**
   * 標記為 DONE 並清除
   */
  complete(sessionId: string): void {
    this.pending.delete(sessionId)
  }

  private transition(sessionId: string, event: ConfirmationEvent): boolean {
    const current = this.getState(sessionId)
    const nextState = VALID_TRANSITIONS[current]?.[event]
    if (!nextState) return false

    const entry = this.pending.get(sessionId)
    if (!entry) return false

    entry.state = nextState
    return true
  }
}
