import { describe, expect, it, vi } from "vitest"
import { LifecycleAwareAgent } from "@/application/use-cases/agent/lifecycle-aware-agent"
import { AgentExecutionVerificationError } from "@/application/use-cases/agent/agent-execution-verifier"

describe("LifecycleAwareAgent", () => {
  it("blocks unverified effect claims before returning to callers", async () => {
    const beforeMessage = vi.fn().mockResolvedValue(undefined)
    const afterMessage = vi.fn().mockResolvedValue(undefined)
    const turnLogger = { log: vi.fn().mockResolvedValue(undefined) }
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        content: "✅ 已記錄 1 個項目：整理簡報",
        toolCalls: [],
      }),
    }

    const agent = new LifecycleAwareAgent(
      delegate,
      { beforeMessage, afterMessage } as never,
      "user-1",
      "API",
      turnLogger,
    )

    await expect(agent.chat("幫我記一下整理簡報", {
      userId: "user-1",
      sessionId: "line-user-1",
    })).rejects.toThrow(AgentExecutionVerificationError)

    expect(beforeMessage).toHaveBeenCalled()
    expect(afterMessage).not.toHaveBeenCalled()
    expect(turnLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      status: "ERROR",
      channel: "API",
      userId: "user-1",
      sessionId: "line-user-1",
    }))
  })

  it("passes through verified tool results", async () => {
    const beforeMessage = vi.fn().mockResolvedValue(undefined)
    const afterMessage = vi.fn().mockResolvedValue(undefined)
    const turnLogger = { log: vi.fn().mockResolvedValue(undefined) }
    const delegateResult = {
      content: "✅ 已記錄 1 個項目：整理簡報",
      toolCalls: ["brain_dump"],
    }
    const delegate = {
      chat: vi.fn().mockResolvedValue(delegateResult),
    }

    const agent = new LifecycleAwareAgent(
      delegate,
      { beforeMessage, afterMessage } as never,
      "user-1",
      "LINE",
      turnLogger,
    )

    await expect(agent.chat("幫我記一下整理簡報", {
      userId: "user-1",
      sessionId: "line-user-1",
    })).resolves.toBe(delegateResult)

    expect(beforeMessage).toHaveBeenCalled()
    expect(afterMessage).toHaveBeenCalled()
    expect(turnLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      status: "SUCCESS",
      channel: "LINE",
      responseText: "✅ 已記錄 1 個項目：整理簡報",
      toolCalls: ["brain_dump"],
      metadata: expect.objectContaining({
        verified: true,
        intentSource: null,
      }),
    }))
  })

  it("enriches pending confirmation turns with synthetic intent for logging", async () => {
    const beforeMessage = vi.fn().mockResolvedValue(undefined)
    const afterMessage = vi.fn().mockResolvedValue(undefined)
    const turnLogger = { log: vi.fn().mockResolvedValue(undefined) }
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        content: "你想要我幫你記下「明天要去買牛奶」嗎？",
        toolCalls: [],
        intent: null,
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        timings: { total_ms: 800 },
        trace: null,
      }),
    }

    const agent = new LifecycleAwareAgent(
      delegate,
      { beforeMessage, afterMessage } as never,
      "user-1",
      "LINE",
      turnLogger,
    )

    await agent.chat("明天要去買牛奶", {
      userId: "user-1",
      sessionId: "line-user-1",
    })

    expect(turnLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      status: "SUCCESS",
      intent: expect.objectContaining({
        object: "pending_confirmation",
        requiresConfirmation: true,
      }),
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      timings: { total_ms: 800 },
      metadata: expect.objectContaining({
        verified: true,
        intentSource: "response.pending_confirmation_prompt",
      }),
    }))
  })

  it("logs best-effort context when delegate throws after returning an unverified result", async () => {
    const beforeMessage = vi.fn().mockResolvedValue(undefined)
    const afterMessage = vi.fn().mockResolvedValue(undefined)
    const turnLogger = { log: vi.fn().mockResolvedValue(undefined) }
    const delegate = {
      chat: vi.fn().mockResolvedValue({
        content: "✅ 已完成「購買牛奶」",
        toolCalls: [],
        intent: {
          object: "task_completion",
          requiresConfirmation: false,
          confidence: 0.9,
        },
        timings: { total_ms: 42 },
      }),
    }

    const agent = new LifecycleAwareAgent(
      delegate,
      { beforeMessage, afterMessage } as never,
      "user-1",
      "API",
      turnLogger,
    )

    await expect(agent.chat("買牛奶已經完成", {
      userId: "user-1",
      sessionId: "api-user-1",
    })).rejects.toThrow(AgentExecutionVerificationError)

    expect(turnLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      status: "ERROR",
      responseText: "✅ 已完成「購買牛奶」",
      intent: expect.objectContaining({
        object: "task_completion",
      }),
      timings: { total_ms: 42 },
      metadata: expect.objectContaining({
        verified: false,
        errorStage: "verify_result",
        intentSource: "result.intent",
      }),
    }))
  })

  it("logs beforeMessage failures instead of dropping the turn", async () => {
    const beforeMessage = vi.fn().mockRejectedValue(new Error("session unavailable"))
    const afterMessage = vi.fn().mockResolvedValue(undefined)
    const turnLogger = { log: vi.fn().mockResolvedValue(undefined) }
    const delegate = {
      chat: vi.fn(),
    }

    const agent = new LifecycleAwareAgent(
      delegate,
      { beforeMessage, afterMessage } as never,
      "user-1",
      "API",
      turnLogger,
    )

    await expect(agent.chat("今天要做什麼", {
      userId: "user-1",
      sessionId: "api-user-1",
    })).rejects.toThrow("session unavailable")

    expect(delegate.chat).not.toHaveBeenCalled()
    expect(turnLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      status: "ERROR",
      requestText: "今天要做什麼",
      metadata: expect.objectContaining({
        errorStage: "before_message",
      }),
    }))
  })
})
