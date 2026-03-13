/**
 * AC2 + AC13: LineAdapter 單元測試
 */

import { describe, expect, it, vi } from "vitest"

const mockGetLineSession = vi.fn()
const mockSaveLineSession = vi.fn()
const mockClearLineSession = vi.fn()

vi.mock("@/lib/line-session", () => ({
  getLineSession: mockGetLineSession,
  saveLineSession: mockSaveLineSession,
  clearLineSession: mockClearLineSession,
}))

const { LineAdapter } = await import("@/application/use-cases/agent/line-adapter")

describe("LineAdapter", () => {
  describe("parseIncoming — text event", () => {
    it("should parse LINE text event into ChannelMessage", () => {
      const adapter = new LineAdapter()
      const result = adapter.parseIncoming({
        type: "text",
        text: "今天的代辦",
        lineUserId: "line-uid-1",
        userId: "user-1",
      })

      expect(result.text).toBe("今天的代辦")
      expect(result.userId).toBe("user-1")
      expect(result.sessionId).toBe("line-uid-1")
      expect(result.channel).toBe("LINE")
      expect(result.metadata?.lineUserId).toBe("line-uid-1")
      expect(result.metadata?.eventType).toBe("text")
    })

    it("should trim whitespace from text", () => {
      const adapter = new LineAdapter()
      const result = adapter.parseIncoming({
        type: "text",
        text: "  幫我記任務  ",
        lineUserId: "line-uid-1",
        userId: "user-1",
      })

      expect(result.text).toBe("幫我記任務")
    })
  })

  describe("parseIncoming — postback event", () => {
    it("should parse LINE postback event with postbackData metadata", () => {
      const adapter = new LineAdapter()
      const result = adapter.parseIncoming({
        type: "postback",
        data: "action=confirm_pending",
        lineUserId: "line-uid-2",
        userId: "user-2",
      })

      expect(result.text).toBe("action=confirm_pending")
      expect(result.channel).toBe("LINE")
      expect(result.metadata?.eventType).toBe("postback")
      expect(result.metadata?.postbackData).toBe("action=confirm_pending")
    })
  })

  describe("formatOutgoing", () => {
    it("should format AgentReply into LINE text message", () => {
      const adapter = new LineAdapter()
      const result = adapter.formatOutgoing({
        content: "今天有 3 個任務",
        toolCalls: ["query_today_tasks"],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      })

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0]?.type).toBe("text")
      expect(result.messages[0]?.text).toBe("今天有 3 個任務")
    })
  })

  describe("pending state — delegates to line-session", () => {
    it("should return null when no pending state", async () => {
      mockGetLineSession.mockResolvedValue(null)
      const adapter = new LineAdapter()
      const result = await adapter.loadPendingState("line-uid-1")
      expect(result).toBeNull()
      expect(mockGetLineSession).toHaveBeenCalledWith("line-uid-1")
    })

    it("should return pending state from line-session", async () => {
      mockGetLineSession.mockResolvedValue({
        type: "adjust_tags_preview",
        payload: { logId: "log-1", taskMatches: [] },
      })
      const adapter = new LineAdapter()
      const result = await adapter.loadPendingState("line-uid-1")

      expect(result?.type).toBe("adjust_tags_preview")
      expect(result?.payload).toEqual({ logId: "log-1", taskMatches: [] })
    })

    it("should save pending state via saveLineSession", async () => {
      mockSaveLineSession.mockResolvedValue(undefined)
      const adapter = new LineAdapter()
      await adapter.savePendingState("line-uid-1", "brain_dump_pending", {
        originalText: "test task",
      })

      expect(mockSaveLineSession).toHaveBeenCalledWith(
        "line-uid-1",
        "brain_dump_pending",
        { originalText: "test task" },
      )
    })

    it("should clear pending state via clearLineSession", async () => {
      mockClearLineSession.mockResolvedValue(undefined)
      const adapter = new LineAdapter()
      await adapter.clearPendingState("line-uid-1")

      expect(mockClearLineSession).toHaveBeenCalledWith("line-uid-1")
    })
  })
})
