/**
 * IntentAwareExecutor — 無記憶、單次觸發、直接 tool calling
 *
 * 取代 NaruAgent delegate，接收 intent 作為輸入，
 * 根據 intent.object 選擇 tool set 和 system prompt，
 * 呼叫 Vercel AI SDK generateText() 做 tool calling。
 */

import { generateText, stepCountIs, type LanguageModel, type ModelMessage, type ToolSet } from "ai"
import type { AgentIntent, AgentDecisionTrace } from "./agent-intent"
import { RESPONSE_AGENT_PROMPT } from "./agent-factories"
import { createParameterizedCompleteTaskSearchTool } from "./complete-task-skill"
import { extractTaskMentions } from "./tool-first-agent"
import { createQueryTodayTasksTool, createQueryCompletedTodayTasksTool } from "./query-tasks-skill"
import { createRunPlannerTool } from "./planner-skill"
import { parseToolResult } from "./tool-result-protocol"

interface AgentChatResult {
  blocked: boolean
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  intent: unknown
  toolCalls: string[]
  toolOutputs?: string[]
  timings: Record<string, number>
  sessionId: string | null
  traceId: string | null
  trace: unknown
}

export interface IntentAwareExecutorConfig {
  model: LanguageModel
  userId: string
  lineUserId?: string
}

export interface ExecuteInput {
  message: string
  intent: AgentIntent
  trace: AgentDecisionTrace
  history: ModelMessage[]
  sessionId: string
}

const TASK_COMPLETION_SYSTEM_PROMPT = `你是 Zentropy 的任務助理。用戶想要標記某個任務為完成。

你必須呼叫 complete_task_search 工具來搜尋並完成任務。

步驟：
1. 從用戶訊息中提取「任務名稱關鍵字」
2. 如有「序號對應表」，用序號查出實際任務名稱
3. 呼叫 complete_task_search，query 填入「實際任務名稱」

範例：
- 用戶說「買牛奶完成了」→ query = "買牛奶"
- 用戶說「幫我把買牛奶標記完成」→ query = "買牛奶"
- 用戶說「第一個做完了」，序號對應表第1個 = 發 email → query = "發 email"
- 用戶說「剛才記的那個」，對話中有「已記錄：繳電費」→ query = "繳電費"
- 用戶說「跑步完成了」→ query = "跑步"
- 用戶說「健身房做完了」→ query = "健身房"

❌ 禁止：
- query 填入「第一個」「那個」「剛才記的」「做完了」等指代詞或動詞
- 不呼叫工具就直接回覆（你必須呼叫 complete_task_search）
- 反問用戶「請告訴我任務名稱」— 任務名稱就在用戶訊息中
✅ 必須：query 填入具體的任務名稱或關鍵字

🚨 收到工具結果後的回覆規則：
- 直接轉達工具回覆的人類可讀訊息，不要改寫
- 如果工具回「找不到」→ 你也回「找不到…請提供更精確的任務名稱」
- 如果工具回「是否完成…」→ 你也回「是否完成…」
- 如果工具回候選清單 → 你也回候選清單
- 絕對不要自行生成道歉（「抱歉」「無法完成」「I'm sorry」）
- 絕對不要用英文回覆

語言：繁體中文`

const PLANNING_SYSTEM_PROMPT = `你是 Zentropy 的 LINE Bot 助理。

用戶想要規劃一個大目標並拆解為任務。你必須使用 run_planner 工具。

使用原始使用者訊息作為規劃輸入，不要自行改寫或省略目標。
工具會自動拆解並建立任務。

規則：
- 語言：繁體中文
- 風格：簡潔直接
- 你必須呼叫 run_planner 工具，不能只用文字回覆

🚨 收到工具結果後的回覆規則：
- 直接轉達工具回覆的內容，不要改寫
- 如果工具回「✅ 規劃完成」→ 你也回工具的完整結果
- 如果工具回「❌ 規劃失敗：<錯誤訊息>」→ 你也原文轉達該錯誤訊息
- 絕對不要自行生成道歉或籠統錯誤（「抱歉」「無法」「請再試一次」）
- 絕對不要用英文回覆`

export class IntentAwareExecutor {
  constructor(private readonly config: IntentAwareExecutorConfig) {}

  async execute(input: ExecuteInput): Promise<AgentChatResult> {
    const { message, intent, trace, history, sessionId } = input
    const { model } = this.config

    const { systemPrompt, tools, toolChoice } = this.resolveToolSet(message, intent, history)

    const t0 = Date.now()

    const messages = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      })),
      { role: "user" as const, content: message },
    ]

    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      toolChoice,
      stopWhen: stepCountIs(3),
      // OpenAI reset_tool_choice pattern: force tool on step 0, auto after
      prepareStep: toolChoice === "required"
        ? ({ stepNumber }) => ({ toolChoice: stepNumber === 0 ? "required" as const : "auto" as const })
        : undefined,
    })

    const t1 = Date.now()

    const toolCallNames = result.steps
      .flatMap((step) => step.toolCalls ?? [])
      .map((tc) => tc.toolName)

    // Collect text from all steps
    const textParts: string[] = []
    for (const step of result.steps) {
      if (step.text) textParts.push(step.text)
    }

    // Also include tool outputs in the response
    const toolOutputs: string[] = []
    for (const step of result.steps) {
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          if ("output" in tr && typeof tr.output === "string") {
            toolOutputs.push(parseToolResult(tr.output).summary)
          }
        }
      }
    }

    const llmText = textParts.join("\n").trim()
    const toolText = toolOutputs.join("\n").trim()

    // Canonical ownership: once a tool succeeds, final user-facing response comes from tool summary.
    const content = (toolCallNames.length > 0 && toolText) ? toolText
      : llmText || toolText
      || "抱歉，我無法處理這個請求。"

    return {
      blocked: false,
      content,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
      },
      intent,
      toolCalls: toolCallNames,
      toolOutputs,
      timings: { executor_ms: t1 - t0 },
      sessionId,
      traceId: null,
      trace: { ...trace, executor: "intent-aware-v1" },
    }
  }

  private buildMentionsContext(history: import("ai").ModelMessage[]): string {
    const mentions = extractTaskMentions(history)
    if (mentions.length === 0) return ""
    return `\n\n序號對應表：\n${mentions.map((m, i) => `第${i + 1}個 = ${m}`).join("\n")}`
  }

  private resolveToolSet(
    message: string,
    intent: AgentIntent,
    history: import("ai").ModelMessage[],
  ): {
    systemPrompt: string
    tools: ToolSet
    toolChoice: "auto" | "required"
  } {
    const { userId, lineUserId } = this.config

    if (intent.object === "task_completion") {
      return {
        systemPrompt: TASK_COMPLETION_SYSTEM_PROMPT + this.buildMentionsContext(history),
        tools: {
          complete_task_search: createParameterizedCompleteTaskSearchTool(userId, lineUserId) as unknown as ToolSet[string],
        },
        toolChoice: "required",
      }
    }

    if (intent.object === "planning") {
      return {
        systemPrompt: PLANNING_SYSTEM_PROMPT,
        tools: {
          run_planner: createRunPlannerTool(userId, message) as unknown as ToolSet[string],
        },
        toolChoice: "required",
      }
    }

    // unknown and other fallthrough intents: read-only tools only
    // P0 safety: unknown intent must NOT trigger mutation tools (brain_dump, complete_task_search, etc.)
    const allTools: ToolSet = {
      query_today_tasks: createQueryTodayTasksTool(userId) as unknown as ToolSet[string],
      query_completed_today_tasks: createQueryCompletedTodayTasksTool(userId) as unknown as ToolSet[string],
    }

    return {
      systemPrompt: RESPONSE_AGENT_PROMPT + this.buildMentionsContext(history),
      tools: allTools,
      toolChoice: "auto",
    }
  }
}
