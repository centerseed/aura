import { describe, expect, it } from "vitest"
import {
  AgentExecutionVerificationError,
  hasEffectClaim,
  verifyAgentExecutionResult,
} from "@/application/use-cases/agent/agent-execution-verifier"

describe("agent-execution-verifier", () => {
  it("detects effect-claim wording", () => {
    expect(hasEffectClaim("✅ 已記錄 1 個項目：整理簡報")).toBe(true)
    expect(hasEffectClaim("✅ 已完成「晨跑」")).toBe(true)
    expect(hasEffectClaim("你剛才記的是：整理簡報")).toBe(false)
    expect(hasEffectClaim("是否完成「晨跑」？")).toBe(false)
  })

  it("throws when a response claims a side effect without execution proof", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已記錄 1 個項目：整理簡報",
      toolCalls: [],
      trace: null,
    })).toThrow(AgentExecutionVerificationError)
  })

  it("accepts side-effect claims when tool calls prove execution", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已完成「晨跑」",
      toolCalls: ["complete_task_search"],
      trace: null,
    })).not.toThrow()
  })

  it("accepts non-effect responses without tool calls", () => {
    expect(() => verifyAgentExecutionResult({
      content: "請直接告訴我要記錄的內容。",
      toolCalls: [],
      trace: null,
    })).not.toThrow()
  })
})
