import { describe, expect, it, vi } from "vitest"
import {
  DeterministicAgentIntentResolver,
  StructuredFallbackAgentIntentResolver,
} from "@/application/use-cases/agent/agent-intent-resolver"

describe("DeterministicAgentIntentResolver", () => {
  const resolver = new DeterministicAgentIntentResolver()

  describe("minimal deterministic fast-path", () => {
    it("keeps '你好' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "你好" })
      expect(result.intent.object).toBe("unknown")
      expect(result.trace.metadata?.reasonCodes).toContain("no_direct_route_match")
    })

    it("keeps '你是誰' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "你是誰" })
      expect(result.intent.object).toBe("unknown")
    })
  })

  // @ac8: fast-path keyword tests — only the 4-5 kept keywords
  describe("task_capture fast-path (prefix keywords only)", () => {
    it("@ac8 classifies '幫我記一下明天開會' as task_capture via prefix", () => {
      const result = resolver.resolve({
        message: "幫我記一下明天下午要跟客戶開產品 review 會議",
      })
      expect(result.intent).toMatchObject({
        object: "task_capture",
        requiresConfirmation: false,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("@ac8 classifies '幫我記一下任務' as task_capture", () => {
      const result = resolver.resolve({
        message: "幫我記一下任務代號 ALPHA-123456，內容是整理競品投影片",
      })
      expect(result.intent.object).toBe("task_capture")
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("@ac8 classifies '記錄買牛奶' as task_capture", () => {
      const result = resolver.resolve({ message: "記錄買牛奶" })
      expect(result.intent.object).toBe("task_capture")
    })

    it("@ac8 classifies '新增任務跑步' as task_capture", () => {
      const result = resolver.resolve({ message: "新增任務跑步" })
      expect(result.intent.object).toBe("task_capture")
    })
  })

  describe("non-capture intents defer to classifier", () => {
    it("@ac4 keeps '幫我記了什麼' as unknown (interrogative, not capture)", () => {
      const result = resolver.resolve({ message: "幫我記了什麼" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '你幫我記了什麼？' as unknown instead of fast-path capture", () => {
      const result = resolver.resolve({ message: "你幫我記了什麼？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("@ac5 keeps '待辦：買牛奶' as unknown (delegated to LLM classifier)", () => {
      // 待辦 patterns no longer fast-pathed; goes to LLM classifier
      const result = resolver.resolve({ message: "待辦：買牛奶" })
      expect(result.intent.object).toBe("unknown")
    })

    it("@ac5 keeps multiline 待辦 input as unknown for classifier", () => {
      const result = resolver.resolve({
        message: "待辦\n10:00銀行繳稅\n12:00拿信件",
      })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '我剛才記了什麼' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "我剛才記了什麼" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '任務代號是什麼' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "任務代號是什麼" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天要做什麼' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天要做什麼？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天有哪些任務' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天有哪些任務" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天 待辦' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天 待辦" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '明天有什麼待辦' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "明天有什麼待辦" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天還有什麼事沒做' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天還有什麼事沒做？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天還沒完成哪些' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天還沒完成哪些" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天完成了什麼' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天完成了什麼？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '今天做了什麼' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "今天做了什麼" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '我明天有什麼會議？' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "我明天有什麼會議？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '明天下午有空嗎？' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "明天下午有空嗎？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps event statements like '今天晚上 8 點線上會議' as unknown", () => {
      const result = resolver.resolve({ message: "今天晚上 8 點線上會議" })
      expect(result.intent.object).toBe("unknown")
    })
  })

  describe("reorganize fast-path", () => {
    it("routes '幫我整理任務' to reorganize", () => {
      const result = resolver.resolve({ message: "幫我整理任務" })
      expect(result.intent).toMatchObject({
        object: "reorganize",
        confidence: 0.97,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("fast_path_reorganize")
    })

    it("routes '整理一下待辦' to reorganize", () => {
      const result = resolver.resolve({ message: "整理一下待辦" })
      expect(result.intent.object).toBe("reorganize")
    })

    // @ac7: calendar_task_link now goes to LLM classifier (no deterministic fast-path)
    it("@ac7 keeps '把第 2 個加到任務' as unknown (delegated to LLM classifier)", () => {
      const result = resolver.resolve({ message: "把第 2 個加到任務" })
      expect(result.intent.object).toBe("unknown")
    })

    // @ac6: classification now goes to LLM classifier (no deterministic fast-path)
    it("@ac6 keeps '把剛剛那個改到行銷產品線' as unknown (delegated to LLM classifier)", () => {
      const result = resolver.resolve({ message: "把剛剛那個改到行銷產品線，不是產品開發" })
      expect(result.intent.object).toBe("unknown")
    })

    it("@ac6 keeps contextual correction phrasing as unknown for classifier", () => {
      const result = resolver.resolve({ message: "剛才那個競品分析要放在行銷產品線，不是研發" })
      expect(result.intent.object).toBe("unknown")
    })
  })

  describe("planning and completion defer to classifier", () => {
    it("keeps '幫我規劃減肥計畫' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "幫我規劃減肥計畫" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '幫我拆解這個專案' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "幫我拆解這個專案" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '規劃是什麼？' as unknown", () => {
      const result = resolver.resolve({ message: "規劃是什麼？" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '把這件事標記完成' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "把這件事標記完成" })
      expect(result.intent.object).toBe("unknown")
      expect(result.trace.metadata?.reasonCodes).toContain("completion_cue_requires_classifier")
    })

    it("routes '信已經發出去給客戶了' to task_completion via status statement", () => {
      const result = resolver.resolve({ message: "信已經發出去給客戶了" })
      expect(result.intent).toMatchObject({
        object: "task_completion",
        requiresConfirmation: true,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("completion_status_statement_fast_path")
    })

    it("routes '牛奶剛買回來了' to completion confirmation", () => {
      const result = resolver.resolve({ message: "牛奶剛買回來了" })
      expect(result.intent).toMatchObject({
        object: "task_completion",
        requiresConfirmation: true,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("completion_status_statement_fast_path")
    })

    // @ac6: '把這個任務移到工作' now goes to LLM classifier
    it("@ac6 keeps '把這個任務移到工作' as unknown (delegated to LLM classifier)", () => {
      const result = resolver.resolve({ message: "把這個任務移到工作" })
      expect(result.intent.object).toBe("unknown")
    })

    it("'今天要去跑步' → unknown", () => {
      const result = resolver.resolve({ message: "今天要去跑步" })
      expect(result.intent.object).toBe("unknown")
    })
  })

  describe("StructuredFallbackAgentIntentResolver", () => {
    it("@ac5 classifies '等等要買牛奶' as task_capture via LLM structured classifier", async () => {
      const decisionAgent = {
        decide: vi.fn().mockResolvedValue({
          decision: {
            object: "task_capture",
            requiresConfirmation: false,
            confidence: 0.81,
          },
          rawText: "{}",
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          timings: {},
          sessionId: "session-1",
          traceId: null,
          trace: {
            classifier: "zentropy-agent-intent-v1",
            usedSummary: false,
            usedMemory: false,
            usedKnowledge: false,
          },
        }),
      }

      const fullResolver = new StructuredFallbackAgentIntentResolver({
        decisionAgent,
        model: {} as never,
      })

      const result = await fullResolver.resolve({
        message: "等等要買牛奶",
        sessionId: "session-1",
        userId: "user-1",
      })

      // Deterministic resolver returns unknown → LLM classifier is invoked
      expect(decisionAgent.decide).toHaveBeenCalledTimes(1)
      // LLM returns task_capture
      expect(result.intent.object).toBe("task_capture")
      expect(result.trace.metadata?.reasonCodes).toContain("structured_classifier_fallback")
    })
  })

  it("uses structured classifier fallback when deterministic resolver returns unknown", async () => {
    const decisionAgent = {
      decide: vi.fn().mockResolvedValue({
        decision: {
          object: "task_capture",
          requiresConfirmation: false,
          confidence: 0.72,
        },
        rawText: "{}",
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        timings: {},
        sessionId: "session-1",
        traceId: null,
        trace: {
          classifier: "zentropy-agent-intent-v1",
          usedSummary: false,
          usedMemory: false,
          usedKnowledge: false,
        },
      }),
    }

    const resolver = new StructuredFallbackAgentIntentResolver({
      decisionAgent,
      model: {} as never,
    })

    const result = await resolver.resolve({
      message: "這邊怪怪的",
      sessionId: "session-1",
      userId: "user-1",
    })

    expect(decisionAgent.decide).toHaveBeenCalledTimes(1)
    expect(result.intent).toMatchObject({
      object: "task_capture",
    })
    expect(result.trace.resolver).toContain("naru-structured-v0.1.2")
    expect(result.trace.metadata?.reasonCodes).toContain("structured_classifier_fallback")
  })
})
