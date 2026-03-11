import { describe, expect, it, vi } from "vitest"
import {
  DeterministicAgentIntentResolver,
  StructuredFallbackAgentIntentResolver,
} from "@/application/use-cases/agent/agent-intent-resolver"

describe("DeterministicAgentIntentResolver", () => {
  const resolver = new DeterministicAgentIntentResolver()

  describe("greeting fast-path", () => {
    it("routes '你好' to greeting", () => {
      const result = resolver.resolve({ message: "你好" })
      expect(result.intent).toMatchObject({
        speechAct: "meta",
        object: "greeting",
        confidence: 0.99,
      })
    })

    it("routes '你是誰' to greeting", () => {
      const result = resolver.resolve({ message: "你是誰" })
      expect(result.intent.object).toBe("greeting")
    })
  })

  describe("explicit brain dump frame fast-path", () => {
    it("classifies '幫我記一下明天開會' as task capture", () => {
      const result = resolver.resolve({
        message: "幫我記一下明天下午要跟客戶開產品 review 會議",
      })
      expect(result.intent).toMatchObject({
        speechAct: "mutate",
        object: "task_capture",
        temporalScope: "future",
        requiresConfirmation: false,
      })
      expect(result.intent.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("classifies '待辦：買牛奶' as task capture", () => {
      const result = resolver.resolve({ message: "待辦：買牛奶" })
      expect(result.intent.object).toBe("task_capture")
      expect(result.intent.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("keeps explicit capture framing over completion wording in mixed inputs", () => {
      const result = resolver.resolve({
        message: "待辦：準備 Q2 OKR 報告初稿，這週五前完成",
      })
      expect(result.intent).toMatchObject({
        speechAct: "mutate",
        object: "task_capture",
        requiresConfirmation: false,
      })
      expect(result.intent.reasonCodes).toContain("explicit_capture_frame_priority")
    })

    it("treats identifier-heavy record payloads as capture", () => {
      const result = resolver.resolve({
        message: "幫我記一下任務代號 ALPHA-123456，內容是整理競品投影片",
      })
      expect(result.intent.object).toBe("task_capture")
      expect(result.intent.reasonCodes).toContain("explicit_capture_frame_priority")
    })
  })

  describe("recall meta fast-path", () => {
    it("routes '我剛才記了什麼' to recall_last_item", () => {
      const result = resolver.resolve({ message: "我剛才記了什麼" })
      expect(result.intent.object).toBe("recall_last_item")
    })

    it("routes '任務代號是什麼' to recall_task_code", () => {
      const result = resolver.resolve({ message: "任務代號是什麼" })
      expect(result.intent.object).toBe("recall_task_code")
    })
  })

  describe("today_focus fast-path", () => {
    it("routes '今天要做什麼' to today_focus", () => {
      const result = resolver.resolve({ message: "今天要做什麼？" })
      expect(result.intent).toMatchObject({
        speechAct: "query",
        object: "today_focus",
        temporalScope: "today",
        confidence: 0.98,
      })
      expect(result.intent.reasonCodes).toContain("fast_path_today_focus")
    })

    it("routes '今天有哪些任務' to today_focus", () => {
      const result = resolver.resolve({ message: "今天有哪些任務" })
      expect(result.intent.object).toBe("today_focus")
    })

    it("routes '明天有什麼待辦' to today_focus", () => {
      const result = resolver.resolve({ message: "明天有什麼待辦" })
      expect(result.intent.object).toBe("today_focus")
    })
  })

  describe("completed_today fast-path", () => {
    it("routes '今天完成了什麼' to completed_today", () => {
      const result = resolver.resolve({ message: "今天完成了什麼？" })
      expect(result.intent).toMatchObject({
        speechAct: "query",
        object: "completed_today",
        temporalScope: "today",
        confidence: 0.98,
      })
      expect(result.intent.reasonCodes).toContain("fast_path_completed_today")
    })

    it("routes '今天做了什麼' to completed_today", () => {
      const result = resolver.resolve({ message: "今天做了什麼" })
      expect(result.intent.object).toBe("completed_today")
    })
  })

  describe("reorganize fast-path", () => {
    it("routes '幫我整理任務' to reorganize", () => {
      const result = resolver.resolve({ message: "幫我整理任務" })
      expect(result.intent).toMatchObject({
        speechAct: "mutate",
        object: "reorganize",
        confidence: 0.97,
      })
      expect(result.intent.reasonCodes).toContain("fast_path_reorganize")
    })

    it("routes '整理一下待辦' to reorganize", () => {
      const result = resolver.resolve({ message: "整理一下待辦" })
      expect(result.intent.object).toBe("reorganize")
    })
  })

  describe("planning fast-path", () => {
    it("routes '幫我規劃減肥計畫' to planning", () => {
      const result = resolver.resolve({ message: "幫我規劃減肥計畫" })
      expect(result.intent).toMatchObject({
        speechAct: "mutate",
        object: "planning",
        confidence: 0.97,
      })
      expect(result.intent.reasonCodes).toContain("fast_path_planning")
    })

    it("routes '幫我拆解這個專案' to planning", () => {
      const result = resolver.resolve({ message: "幫我拆解這個專案" })
      expect(result.intent.object).toBe("planning")
    })

    it("does NOT fast-path '規劃是什麼？' (question about planning)", () => {
      const result = resolver.resolve({ message: "規劃是什麼？" })
      expect(result.intent.object).toBe("unknown")
    })
  })

  describe("everything else → unknown (delegate to LLM)", () => {
    it("'今天要去跑步' → unknown", () => {
      const result = resolver.resolve({ message: "今天要去跑步" })
      expect(result.intent.object).toBe("unknown")
    })

    it("'把這件事標記完成' → task_completion (deterministic fast-path)", () => {
      const result = resolver.resolve({ message: "把這件事標記完成" })
      expect(result.intent.object).toBe("task_completion")
    })

    it("'把這個任務移到工作' → unknown (LLM handles classification)", () => {
      const result = resolver.resolve({ message: "把這個任務移到工作" })
      expect(result.intent.object).toBe("unknown")
    })
  })

  it("uses structured classifier fallback when deterministic resolver returns unknown", async () => {
    const decisionAgent = {
      decide: vi.fn().mockResolvedValue({
        decision: {
          speechAct: "mutate",
          object: "task_capture",
          targetReferenceMode: "none",
          temporalScope: "future",
          requiresConfirmation: false,
          confidence: 0.72,
          reasonCodes: ["structured_task_capture"],
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
      speechAct: "mutate",
      object: "task_capture",
      temporalScope: "future",
    })
    expect(result.trace.resolver).toContain("naru-structured-v0.1.2")
  })
})
