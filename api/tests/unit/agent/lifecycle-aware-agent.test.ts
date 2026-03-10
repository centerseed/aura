import { describe, expect, it, vi } from "vitest"
import { LifecycleAwareAgent } from "@/application/use-cases/agent/lifecycle-aware-agent"
import { AgentExecutionVerificationError } from "@/application/use-cases/agent/agent-execution-verifier"

describe("LifecycleAwareAgent", () => {
  it("blocks unverified effect claims before returning to callers", async () => {
    const beforeMessage = vi.fn().mockResolvedValue(undefined)
    const afterMessage = vi.fn().mockResolvedValue(undefined)
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
    )

    await expect(agent.chat("幫我記一下整理簡報", {
      userId: "user-1",
      sessionId: "line-user-1",
    })).rejects.toThrow(AgentExecutionVerificationError)

    expect(beforeMessage).toHaveBeenCalled()
    expect(afterMessage).not.toHaveBeenCalled()
  })

  it("passes through verified tool results", async () => {
    const beforeMessage = vi.fn().mockResolvedValue(undefined)
    const afterMessage = vi.fn().mockResolvedValue(undefined)
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
    )

    await expect(agent.chat("幫我記一下整理簡報", {
      userId: "user-1",
      sessionId: "line-user-1",
    })).resolves.toBe(delegateResult)

    expect(beforeMessage).toHaveBeenCalled()
    expect(afterMessage).toHaveBeenCalled()
  })
})
