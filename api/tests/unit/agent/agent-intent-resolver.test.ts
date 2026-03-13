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

  describe("explicit brain dump frame fast-path", () => {
    it("classifies '幫我記一下明天開會' as task capture", () => {
      const result = resolver.resolve({
        message: "幫我記一下明天下午要跟客戶開產品 review 會議",
      })
      expect(result.intent).toMatchObject({
        object: "task_capture",
        requiresConfirmation: false,
      })
      expect(result.trace.metadata?.temporalScope).toBe("future")
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("classifies '待辦：買牛奶' as task capture", () => {
      const result = resolver.resolve({ message: "待辦：買牛奶" })
      expect(result.intent.object).toBe("task_capture")
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("keeps standalone '待辦' as unknown instead of capture", () => {
      const result = resolver.resolve({ message: "待辦" })
      expect(result.intent.object).toBe("unknown")
    })

    it("classifies heading + multiline items as task capture", () => {
      const result = resolver.resolve({
        message: "待辦\n10:00銀行繳稅\n12:00拿信件",
      })
      expect(result.intent.object).toBe("task_capture")
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("keeps explicit capture framing over completion wording in mixed inputs", () => {
      const result = resolver.resolve({
        message: "待辦：準備 Q2 OKR 報告初稿，這週五前完成",
      })
      expect(result.intent).toMatchObject({
        object: "task_capture",
        requiresConfirmation: false,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("treats identifier-heavy record payloads as capture", () => {
      const result = resolver.resolve({
        message: "幫我記一下任務代號 ALPHA-123456，內容是整理競品投影片",
      })
      expect(result.intent.object).toBe("task_capture")
      expect(result.trace.metadata?.reasonCodes).toContain("explicit_capture_frame_priority")
    })
  })

  describe("non-capture intents defer to classifier", () => {
    it("keeps '我剛才記了什麼' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "我剛才記了什麼" })
      expect(result.intent.object).toBe("unknown")
    })

    it("keeps '你幫我記了什麼？' as unknown instead of fast-path capture", () => {
      const result = resolver.resolve({ message: "你幫我記了什麼？" })
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

    it("routes '把第 2 個加到任務' to calendar_task_link", () => {
      const result = resolver.resolve({ message: "把第 2 個加到任務" })
      expect(result.intent).toMatchObject({
        object: "calendar_task_link",
        requiresConfirmation: false,
        confidence: 0.97,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("calendar_task_link_fast_path")
      expect(result.trace.metadata?.targetReferenceMode).toBe("contextual")
    })

    it("routes contextual classification correction away from completion", () => {
      const result = resolver.resolve({ message: "把剛剛那個改到行銷產品線，不是產品開發" })
      expect(result.intent).toMatchObject({
        object: "classification",
        requiresConfirmation: false,
      })
      expect(result.trace.metadata?.targetReferenceMode).toBe("contextual")
      expect(result.trace.metadata?.reasonCodes).toContain("adjust_classification_fast_path")
    })

    it("routes contextual correction phrasing with '放在 ... 不是 ...' to classification", () => {
      const result = resolver.resolve({ message: "剛才那個競品分析要放在行銷產品線，不是研發" })
      expect(result.intent.object).toBe("classification")
      expect(result.trace.metadata?.targetReferenceMode).toBe("contextual")
      expect(result.trace.metadata?.reasonCodes).toContain("adjust_classification_fast_path")
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

    it("keeps '信已經發出去給客戶了' as unknown for the classifier", () => {
      const result = resolver.resolve({ message: "信已經發出去給客戶了" })
      expect(result.intent).toMatchObject({
        object: "task_completion",
        requiresConfirmation: true,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("completion_status_statement_fast_path")
    })

    it("routes '牛奶剛買回來了' to completion confirmation instead of capture", () => {
      const result = resolver.resolve({ message: "牛奶剛買回來了" })
      expect(result.intent).toMatchObject({
        object: "task_completion",
        requiresConfirmation: true,
      })
      expect(result.trace.metadata?.reasonCodes).toContain("completion_status_statement_fast_path")
    })

    it("'把這個任務移到工作' → classification", () => {
      const result = resolver.resolve({ message: "把這個任務移到工作" })
      expect(result.intent.object).toBe("classification")
      expect(result.trace.metadata?.reasonCodes).toContain("adjust_classification_fast_path")
    })

    it("'今天要去跑步' → unknown", () => {
      const result = resolver.resolve({ message: "今天要去跑步" })
      expect(result.intent.object).toBe("unknown")
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
