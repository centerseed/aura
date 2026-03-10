import { describe, expect, it, vi } from "vitest"
import {
  DeterministicAgentIntentResolver,
  StructuredFallbackAgentIntentResolver,
} from "@/application/use-cases/agent/agent-intent-resolver"

describe("DeterministicAgentIntentResolver", () => {
  const resolver = new DeterministicAgentIntentResolver()

  it("prefers task completion mutation over completed-today query when both completion and action request appear", () => {
    const result = resolver.resolve({
      message: "我今天已經跑完步了，幫我標記完成",
    })

    expect(result.intent).toMatchObject({
      speechAct: "mutate",
      object: "task_completion",
      targetReferenceMode: "explicit",
    })
    expect(result.intent.reasonCodes).toContain("completion_mutation_request")
  })

  it("keeps explicit completed-today queries in query space", () => {
    const result = resolver.resolve({
      message: "我今天完成了什麼？",
    })

    expect(result.intent).toMatchObject({
      speechAct: "query",
      object: "completed_today",
      temporalScope: "today",
    })
  })

  it("marks contextual completion as contextual reference", () => {
    const result = resolver.resolve({
      message: "把這件事標記完成",
    })

    expect(result.intent).toMatchObject({
      speechAct: "mutate",
      object: "task_completion",
      targetReferenceMode: "contextual",
      requiresConfirmation: true,
    })
  })

  it("classifies explicit capture requests as task capture", () => {
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

  it("keeps today-focus queries out of capture routing", () => {
    const result = resolver.resolve({
      message: "今天要做什麼？",
    })

    expect(result.intent).toMatchObject({
      speechAct: "query",
      object: "today_focus",
    })
  })

  it("prefers explicit capture framing over completion wording in mixed inputs", () => {
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

  it("treats identifier-heavy record payloads as capture instead of reorganize", () => {
    const result = resolver.resolve({
      message: "幫我記一下任務代號 ALPHA-123456，內容是整理競品投影片",
    })

    expect(result.intent).toMatchObject({
      speechAct: "mutate",
      object: "task_capture",
    })
    expect(result.intent.reasonCodes).toContain("explicit_capture_frame_priority")
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
