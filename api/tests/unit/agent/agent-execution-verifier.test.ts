import { describe, expect, it } from "vitest"
import {
  AgentExecutionVerificationError,
  hasEffectClaim,
  hasToolOutputSoftFailure,
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

  it("throws when query-only tools are called but response claims side effect", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已記錄 1 個項目：整理簡報",
      toolCalls: ["query_today_tasks"],
      trace: null,
    })).toThrow(AgentExecutionVerificationError)
  })

  it("accepts mutation tool call with effect claim", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已記錄 1 個項目：整理簡報",
      toolCalls: ["brain_dump"],
      trace: null,
    })).not.toThrow()
  })

  it("accepts query-only tool calls without effect claim", () => {
    expect(() => verifyAgentExecutionResult({
      content: "今天有 3 個任務待完成。",
      toolCalls: ["query_today_tasks", "query_completed_today_tasks"],
      trace: null,
    })).not.toThrow()
  })

  it("throws when mutation tool was called but output indicates soft failure", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已完成「晨跑」",
      toolCalls: ["complete_task_search"],
      toolOutputs: ["找不到與「晨跑」相關的任務。請提供更精確的任務名稱。"],
      trace: null,
    })).toThrow(AgentExecutionVerificationError)
  })

  it("accepts mutation tool when output does not indicate failure", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已完成「晨跑」",
      toolCalls: ["complete_task_search"],
      toolOutputs: ["是否完成「晨跑」？回覆確認執行。"],
      trace: null,
    })).not.toThrow()
  })

  it("accepts mutation tool with no toolOutputs field", () => {
    expect(() => verifyAgentExecutionResult({
      content: "✅ 已記錄 1 個項目：整理簡報",
      toolCalls: ["brain_dump"],
      trace: null,
    })).not.toThrow()
  })
})

describe("hasToolOutputSoftFailure", () => {
  it("detects soft failure patterns in tool outputs", () => {
    expect(hasToolOutputSoftFailure(["找不到相關任務"])).toBe(true)
    expect(hasToolOutputSoftFailure(["操作失敗：權限不足"])).toBe(true)
    expect(hasToolOutputSoftFailure(["目前沒有進行中的任務"])).toBe(true)
    expect(hasToolOutputSoftFailure(["無法識別操作類型"])).toBe(true)
  })

  it("returns false for successful outputs", () => {
    expect(hasToolOutputSoftFailure(["✅ 已完成「晨跑」"])).toBe(false)
    expect(hasToolOutputSoftFailure(["是否完成「晨跑」？"])).toBe(false)
  })

  it("returns false for non-array or empty input", () => {
    expect(hasToolOutputSoftFailure(undefined)).toBe(false)
    expect(hasToolOutputSoftFailure(null)).toBe(false)
    expect(hasToolOutputSoftFailure([])).toBe(false)
  })
})
