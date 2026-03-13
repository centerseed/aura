/**
 * AC1: ChannelMessage 統一訊息介面
 *
 * Tests that ChannelMessage can be constructed for each channel type
 * and that the required fields are correctly typed.
 */

import { describe, expect, it } from "vitest"
import type { ChannelMessage, AgentReply } from "@/application/use-cases/agent/channel-adapter"

describe("ChannelMessage interface", () => {
  it("should represent a LINE text message with required fields", () => {
    const msg: ChannelMessage = {
      text: "今天有什麼任務",
      userId: "user-abc",
      sessionId: "line-uid-123",
      channel: "LINE",
      metadata: { lineUserId: "line-uid-123", eventType: "text" },
    }

    expect(msg.text).toBe("今天有什麼任務")
    expect(msg.userId).toBe("user-abc")
    expect(msg.sessionId).toBe("line-uid-123")
    expect(msg.channel).toBe("LINE")
    expect(msg.metadata?.lineUserId).toBe("line-uid-123")
  })

  it("should represent an API message with required fields", () => {
    const msg: ChannelMessage = {
      text: "幫我記錄任務",
      userId: "user-def",
      sessionId: "session-xyz",
      channel: "API",
      metadata: {},
    }

    expect(msg.text).toBe("幫我記錄任務")
    expect(msg.userId).toBe("user-def")
    expect(msg.sessionId).toBe("session-xyz")
    expect(msg.channel).toBe("API")
  })

  it("should allow metadata to be omitted (optional)", () => {
    const msg: ChannelMessage = {
      text: "hello",
      userId: "user-1",
      sessionId: "sess-1",
      channel: "API",
    }

    expect(msg.metadata).toBeUndefined()
  })

  it("should support postback metadata for LINE channel", () => {
    const msg: ChannelMessage = {
      text: "confirm_pending",
      userId: "user-1",
      sessionId: "line-uid-1",
      channel: "LINE",
      metadata: {
        lineUserId: "line-uid-1",
        eventType: "postback",
        postbackData: "action=confirm_pending",
      },
    }

    expect(msg.channel).toBe("LINE")
    expect(msg.metadata?.eventType).toBe("postback")
    expect(msg.metadata?.postbackData).toBe("action=confirm_pending")
  })
})

describe("AgentReply interface", () => {
  it("should represent a basic text reply", () => {
    const reply: AgentReply = {
      content: "今天有 3 件待辦事項",
      toolCalls: ["query_today_tasks"],
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    }

    expect(reply.content).toBe("今天有 3 件待辦事項")
    expect(reply.toolCalls).toHaveLength(1)
    expect(reply.usage.totalTokens).toBe(80)
  })

  it("should support pendingConfirmation field", () => {
    const reply: AgentReply = {
      content: "是否要把「整理任務」移到個人分類？",
      toolCalls: ["adjust_tags_preview"],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      pendingConfirmation: {
        type: "adjust_tags_preview",
        payload: { logId: "log-1", taskMatches: [] },
      },
    }

    expect(reply.pendingConfirmation?.type).toBe("adjust_tags_preview")
  })
})
