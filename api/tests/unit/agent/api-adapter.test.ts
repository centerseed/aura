/**
 * AC3 + AC13: ApiAdapter 單元測試
 */

import { describe, expect, it } from "vitest"
import { ApiAdapter } from "@/application/use-cases/agent/api-adapter"
import type { AgentReply } from "@/application/use-cases/agent/channel-adapter"

describe("ApiAdapter", () => {
  describe("parseIncoming", () => {
    it("should parse message and userId into ChannelMessage", () => {
      const adapter = new ApiAdapter()
      const result = adapter.parseIncoming({
        message: "  今天的代辦  ",
        userId: "user-1",
        session_id: "sess-abc",
      })

      expect(result.text).toBe("今天的代辦")
      expect(result.userId).toBe("user-1")
      expect(result.sessionId).toBe("sess-abc")
      expect(result.channel).toBe("API")
    })

    it("should default sessionId to 'default' when not provided", () => {
      const adapter = new ApiAdapter()
      const result = adapter.parseIncoming({
        message: "hello",
        userId: "user-1",
      })

      expect(result.sessionId).toBe("default")
      expect(result.channel).toBe("API")
    })

    it("should trim whitespace from message", () => {
      const adapter = new ApiAdapter()
      const result = adapter.parseIncoming({
        message: "\n\t 記任務  \n",
        userId: "user-1",
      })

      expect(result.text).toBe("記任務")
    })
  })

  describe("formatOutgoing", () => {
    it("should format AgentReply into API JSON response", () => {
      const adapter = new ApiAdapter()
      const reply: AgentReply = {
        content: "已記錄 1 個項目",
        toolCalls: ["brain_dump"],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }

      const result = adapter.formatOutgoing(reply)

      expect(result.reply).toBe("已記錄 1 個項目")
      expect(result.tool_calls).toEqual(["brain_dump"])
      expect(result.usage.totalTokens).toBe(150)
    })

    it("should pass through empty tool_calls", () => {
      const adapter = new ApiAdapter()
      const reply: AgentReply = {
        content: "你好！",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }

      const result = adapter.formatOutgoing(reply)

      expect(result.tool_calls).toHaveLength(0)
      expect(result.reply).toBe("你好！")
    })
  })

  describe("pending state management", () => {
    it("should return null when no pending state exists", async () => {
      const adapter = new ApiAdapter()
      const result = await adapter.loadPendingState("sess-1")
      expect(result).toBeNull()
    })

    it("should save and load pending state", async () => {
      const adapter = new ApiAdapter()
      await adapter.savePendingState("sess-1", "adjust_tags_preview", { logId: "log-1" })
      const loaded = await adapter.loadPendingState("sess-1")

      expect(loaded?.type).toBe("adjust_tags_preview")
      expect(loaded?.payload).toEqual({ logId: "log-1" })
    })

    it("should clear pending state", async () => {
      const adapter = new ApiAdapter()
      await adapter.savePendingState("sess-1", "brain_dump_pending", { originalText: "test" })
      await adapter.clearPendingState("sess-1")
      const loaded = await adapter.loadPendingState("sess-1")

      expect(loaded).toBeNull()
    })

    it("should isolate pending state per session", async () => {
      const adapter = new ApiAdapter()
      await adapter.savePendingState("sess-a", "complete_task_confirm", { taskTitle: "Task A" })
      await adapter.savePendingState("sess-b", "brain_dump_pending", { originalText: "Task B" })

      const stateA = await adapter.loadPendingState("sess-a")
      const stateB = await adapter.loadPendingState("sess-b")

      expect(stateA?.type).toBe("complete_task_confirm")
      expect(stateB?.type).toBe("brain_dump_pending")
    })
  })
})
