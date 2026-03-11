import { beforeEach, describe, expect, it, vi } from "vitest"
import { IntentAwareExecutor } from "@/application/use-cases/agent/intent-aware-executor"
import type { AgentIntent, AgentDecisionTrace } from "@/application/use-cases/agent/agent-intent"

const { mockGenerateText, mockCreateRunPlannerTool } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockCreateRunPlannerTool: vi.fn(() => ({ name: "run_planner" })),
}))

vi.mock("ai", () => ({
  generateText: mockGenerateText,
  stepCountIs: vi.fn((n: number) => `stepCountIs(${n})`),
}))

vi.mock("@/application/use-cases/agent/brain-dump-skill", () => ({
  createBrainDumpTool: vi.fn(() => ({ name: "brain_dump" })),
}))

vi.mock("@/application/use-cases/agent/complete-task-skill", () => ({
  createCompleteTaskSearchTool: vi.fn(() => ({ name: "complete_task_search" })),
  createParameterizedCompleteTaskSearchTool: vi.fn(() => ({ name: "complete_task_search" })),
}))

vi.mock("@/application/use-cases/agent/tool-first-agent", () => ({
  extractTaskMentions: vi.fn((history: Array<{ role: string; content: string }>) => {
    const items: string[] = []
    for (const msg of history) {
      if (msg.role !== "assistant" || typeof msg.content !== "string") continue
      for (const match of msg.content.matchAll(/(?:^|\n)\d+\.\s+(.+)/g)) {
        const raw = match[1]?.trim()
        if (!raw) continue
        items.push(raw.replace(/\s+\[[^\]]+\].*$/, "").trim())
      }
    }
    return items
  }),
}))

vi.mock("@/application/use-cases/agent/adjust-tags-skill", () => ({
  createAdjustTagsTool: vi.fn(() => ({ name: "adjust_tags_preview" })),
}))

vi.mock("@/application/use-cases/agent/query-tasks-skill", () => ({
  createQueryTodayTasksTool: vi.fn(() => ({ name: "query_today_tasks" })),
  createQueryCompletedTodayTasksTool: vi.fn(() => ({ name: "query_completed_today_tasks" })),
}))

vi.mock("@/application/use-cases/agent/reorganize-skill", () => ({
  createReorganizeTool: vi.fn(() => ({ name: "reorganize_preview" })),
}))

vi.mock("@/application/use-cases/agent/planner-skill", () => ({
  createRunPlannerTool: mockCreateRunPlannerTool,
}))

vi.mock("@/application/use-cases/agent/agent-factories", () => ({
  RESPONSE_AGENT_PROMPT: "mock response agent prompt",
}))

function buildIntent(object: AgentIntent["object"]): AgentIntent {
  return {
    speechAct: "meta",
    object,
    targetReferenceMode: "none",
    temporalScope: "none",
    requiresConfirmation: false,
    confidence: 0.97,
    reasonCodes: ["test"],
  }
}

function buildTrace(intent: AgentIntent): AgentDecisionTrace {
  return {
    routeSource: "intent_resolver",
    resolver: "test",
    rawMessage: "test",
    resolvedIntent: intent,
    selectedTool: null,
    targetQuery: null,
  }
}

describe("IntentAwareExecutor", () => {
  let executor: IntentAwareExecutor

  beforeEach(() => {
    vi.clearAllMocks()
    executor = new IntentAwareExecutor({
      model: {} as any,
      userId: "user-1",
      lineUserId: "line-user-1",
    })
  })

  it("routes planning intent with run_planner tool and required toolChoice", async () => {
    const intent = buildIntent("planning")
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "已規劃完成",
          toolCalls: [{ toolName: "run_planner" }],
          toolResults: [{ output: "✅ 規劃完成！共建立 3 個任務" }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "幫我規劃健身計畫",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.toolChoice).toBe("required")
    expect(call.stopWhen).toBe("stepCountIs(3)")
    expect(call.prepareStep).toBeTypeOf("function")
    expect(Object.keys(call.tools)).toEqual(["run_planner"])
    // Verify prepareStep resets toolChoice after step 0 (OpenAI reset_tool_choice pattern)
    expect(call.prepareStep({ stepNumber: 0 })).toEqual({ toolChoice: "required" })
    expect(call.prepareStep({ stepNumber: 1 })).toEqual({ toolChoice: "auto" })
    expect(result.toolCalls).toEqual(["run_planner"])
    expect(mockCreateRunPlannerTool).toHaveBeenCalledWith("user-1", "幫我規劃健身計畫")
    expect(result.content).toBe("✅ 規劃完成！共建立 3 個任務")
    expect(result.sessionId).toBe("session-1")
  })

  it("routes unknown intent with read-only tools only and auto toolChoice", async () => {
    const intent = buildIntent("unknown")
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "我可以幫你記錄任務、查詢待辦等",
          toolCalls: [],
          toolResults: [],
        },
      ],
      usage: { inputTokens: 80, outputTokens: 30 },
    })

    const result = await executor.execute({
      message: "今天天氣真好",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    const call0 = mockGenerateText.mock.calls[0][0]
    expect(call0.toolChoice).toBe("auto")
    expect(call0.prepareStep).toBeUndefined()
    const toolNames = Object.keys(call0.tools)
    // P0 safety: unknown intent only gets read-only tools
    expect(toolNames).toEqual(["query_today_tasks", "query_completed_today_tasks"])
    expect(toolNames).not.toContain("brain_dump")
    expect(toolNames).not.toContain("run_planner")
    expect(toolNames).not.toContain("complete_task_search")
    expect(toolNames).not.toContain("adjust_tags_preview")
    expect(toolNames).not.toContain("reorganize_preview")
    expect(result.content).toBe("我可以幫你記錄任務、查詢待辦等")
  })

  it("falls back to tool results when text is empty", async () => {
    const intent = buildIntent("planning")
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "",
          toolCalls: [{ toolName: "run_planner" }],
          toolResults: [{ output: "✅ 規劃完成！共建立 5 個任務" }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "幫我規劃學英文",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    expect(result.content).toBe("✅ 規劃完成！共建立 5 個任務")
    expect(result.toolCalls).toEqual(["run_planner"])
  })

  it("prefers canonical tool summary over LLM paraphrase when a tool was called", async () => {
    const intent = buildIntent("planning")
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "我幫你整理成一些步驟了",
          toolCalls: [{ toolName: "run_planner" }],
          toolResults: [{ output: "✅ 規劃完成！共建立 4 個任務" }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "幫我規劃學英文",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    expect(result.content).toBe("✅ 規劃完成！共建立 4 個任務")
  })

  it("includes usage and timing information", async () => {
    const intent = buildIntent("unknown")
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [{ text: "test", toolCalls: [], toolResults: [] }],
      usage: { inputTokens: 200, outputTokens: 100 },
    })

    const result = await executor.execute({
      message: "test",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    expect(result.usage.promptTokens).toBe(200)
    expect(result.usage.completionTokens).toBe(100)
    expect(result.usage.totalTokens).toBe(300)
    expect(result.timings).toHaveProperty("executor_ms")
  })

  it("routes task_completion with parameterized tool, required toolChoice, and mentions context", async () => {
    const intent = buildIntent("task_completion")
    intent.speechAct = "mutate"
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "是否完成「跑步」？",
          toolCalls: [{ toolName: "complete_task_search" }],
          toolResults: [{ output: "..." }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "把第一個標記完成",
      intent,
      trace,
      history: [
        {
          role: "assistant" as const,
          content: "📋 目前查到 2 項：\n\n1. 跑步 [健康]\n2. 買牛奶 [生活]",
        },
      ],
      sessionId: "session-1",
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.toolChoice).toBe("required")
    expect(Object.keys(call.tools)).toEqual(["complete_task_search"])
    // Verify mentions are injected into system prompt
    expect(call.system).toContain("跑步")
    expect(call.system).toContain("買牛奶")
    expect(result.toolCalls).toEqual(["complete_task_search"])
  })

  it("strips [FACTS] block from tool output in content", async () => {
    const intent = buildIntent("task_completion")
    intent.speechAct = "mutate"
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "",
          toolCalls: [{ toolName: "complete_task_search" }],
          toolResults: [{
            output: '[FACTS]\n{"query":"跑步","decision":"awaiting_confirmation"}\n[/FACTS]\n\n是否完成「跑步」？\n\n回覆「確認」執行，或無視此訊息取消。',
          }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "跑步完成了",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    expect(result.content).toBe("是否完成「跑步」？\n\n回覆「確認」執行，或無視此訊息取消。")
    expect(result.content).not.toContain("[FACTS]")
  })

  it("uses prepareStep to reset toolChoice after first step (prevents retry loop)", async () => {
    const intent = buildIntent("task_completion")
    intent.speechAct = "mutate"
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "",
          toolCalls: [{ toolName: "complete_task_search" }],
          toolResults: [{ output: "找不到與「XXX」相關的任務。" }],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    await executor.execute({
      message: "XXX 完成了",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prepareStep).toBeTypeOf("function")
    // Step 0: forced tool call; Step 1+: auto (LLM can respond with text)
    expect(call.prepareStep({ stepNumber: 0 })).toEqual({ toolChoice: "required" })
    expect(call.prepareStep({ stepNumber: 1 })).toEqual({ toolChoice: "auto" })
    expect(call.prepareStep({ stepNumber: 2 })).toEqual({ toolChoice: "auto" })
  })

  it("prefers tool output when LLM generates an apology", async () => {
    const intent = buildIntent("task_completion")
    intent.speechAct = "mutate"
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "",
          toolCalls: [{ toolName: "complete_task_search" }],
          toolResults: [{
            output: '[FACTS]\n{"query":"健身房","decision":"no_match"}\n[/FACTS]\n\n找不到與「健身房」相關的任務。請提供更精確的任務名稱或關鍵字，讓我判斷候選任務。',
          }],
        },
        {
          text: "抱歉，我無法完成這個請求。",
          toolCalls: [],
          toolResults: [],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "健身房做完了",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    // Should use tool output, not LLM's apology
    expect(result.content).toBe("找不到與「健身房」相關的任務。請提供更精確的任務名稱或關鍵字，讓我判斷候選任務。")
    expect(result.content).not.toContain("抱歉")
  })

  it("prefers tool output when LLM generates English error", async () => {
    const intent = buildIntent("task_completion")
    intent.speechAct = "mutate"
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [
        {
          text: "",
          toolCalls: [{ toolName: "complete_task_search" }],
          toolResults: [{
            output: '[FACTS]\n{"query":"跑步","decision":"no_match"}\n[/FACTS]\n\n找不到與「跑步」相關的任務。請提供更精確的任務名稱或關鍵字，讓我判斷候選任務。',
          }],
        },
        {
          text: "I'm sorry, I encountered an error while processing your request.",
          toolCalls: [],
          toolResults: [],
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    const result = await executor.execute({
      message: "第一個做完了",
      intent,
      trace,
      history: [],
      sessionId: "session-1",
    })

    // Should use tool output, not LLM's English error
    expect(result.content).toBe("找不到與「跑步」相關的任務。請提供更精確的任務名稱或關鍵字，讓我判斷候選任務。")
    expect(result.content).not.toContain("sorry")
  })

  it("passes conversation history to generateText", async () => {
    const intent = buildIntent("planning")
    const trace = buildTrace(intent)

    mockGenerateText.mockResolvedValue({
      steps: [{ text: "ok", toolCalls: [], toolResults: [] }],
      usage: { inputTokens: 50, outputTokens: 20 },
    })

    await executor.execute({
      message: "幫我規劃",
      intent,
      trace,
      history: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！" },
      ],
      sessionId: "session-1",
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.messages).toEqual([
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好！" },
      { role: "user", content: "幫我規劃" },
    ])
  })
})
