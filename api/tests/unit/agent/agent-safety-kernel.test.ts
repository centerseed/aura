import { describe, expect, it, vi } from "vitest"
import { DeterministicAgentIntentResolver } from "@/application/use-cases/agent/agent-intent-resolver"
import { ToolFirstAgent } from "@/application/use-cases/agent/tool-first-agent"

describe("Agent Safety Kernel", () => {
  it("capture framing beats completion wording", () => {
    const resolver = new DeterministicAgentIntentResolver()

    const result = resolver.resolve({
      message: "待辦：準備 Q2 OKR 報告初稿，這週五前完成",
    })

    expect(result.intent.object).toBe("task_capture")
    expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
  })

  it("identifier-heavy record payload does not leak into reorganize routing", () => {
    const resolver = new DeterministicAgentIntentResolver()

    const result = resolver.resolve({
      message: "幫我記一下任務代號 ALPHA-123456，內容是整理競品投影片",
    })

    expect(result.intent.object).toBe("task_capture")
    expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
  })

  it("underspecified short input is handled locally without remote classifier", async () => {
    const intentResolver = {
      resolve: vi.fn().mockRejectedValue(new Error("remote classifier should not run")),
    }

    const agent = new ToolFirstAgent({
      delegate: { chat: vi.fn() },
      sessionStore: {
        get: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockResolvedValue(undefined),
      },
      memoryManager: null,
      intentResolver,
    })

    const result = await agent.chat("記", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(intentResolver.resolve).not.toHaveBeenCalled()
    expect(result.content).toContain("請直接告訴我要記錄的內容")
  })
})
