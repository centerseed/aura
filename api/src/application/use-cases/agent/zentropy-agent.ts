/**
 * ZentropyAgent 工廠
 *
 * 組合 Skills + Model → NaruAgent（直接使用原版 naru-agent-js）
 */

import {
  LLMStructuredClassifier,
} from "naru-agent-js"
import { AgentIntentSchema, type AgentIntent } from "./agent-intent"
import { createBrainDumpSkill } from "./brain-dump-skill"
import { createReorganizeSkill } from "./reorganize-skill"
import { createPlannerSkill } from "./planner-skill"
import { createQueryTasksSkill } from "./query-tasks-skill"
import { createAdjustTagsSkill } from "./adjust-tags-skill"
import { createCompleteTaskSkill } from "./complete-task-skill"
import { StructuredFallbackAgentIntentResolver } from "./agent-intent-resolver"
import { getAgentRuntime } from "./agent-runtime"
import { LifecycleAwareAgent } from "./lifecycle-aware-agent"
import { ToolFirstAgent } from "./tool-first-agent"
import { IntentAwareExecutor } from "./intent-aware-executor"
import { GroqPromptGuardrail } from "@/application/services/groq-prompt-guardrail"
import { getAgentChatModel, getAgentRoutingMode, getAgentSummaryModel } from "@/lib/agent-model"
import { createDecisionFallbackAgent, createResponseAgent, type AgentRuntimeParts } from "./agent-factories"

function buildExperimentalGuardrails() {
  if (process.env.AGENT_PROMPT_GUARD_ENABLED !== "true") {
    return undefined
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.warn("[agent] AGENT_PROMPT_GUARD_ENABLED=true but GROQ_API_KEY is missing")
    return undefined
  }

  return [
    new GroqPromptGuardrail({
      apiKey,
      model: process.env.AGENT_PROMPT_GUARD_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      classificationMode: (process.env.AGENT_PROMPT_GUARD_MODE as "numeric_threshold" | "safe_unsafe_label" | undefined)
        || "safe_unsafe_label",
      blockThreshold: Number(process.env.AGENT_PROMPT_GUARD_BLOCK_THRESHOLD || "0.5"),
    }),
  ]
}

const DECISION_PROMPT = `你是 Zentropy LINE Agent 的 decision layer。你的唯一工作是判定用戶這一句話的 canonical intent。

## Intent 清單

query（查詢，不改變任何資料）：
- today_focus：查今天待辦（「今天要做什麼」「有什麼任務」）
- completed_today：查今天完成項目（「今天完成了什麼」）
- recall_last_item：查剛才記了什麼（「我剛才記了什麼」）
- recall_task_code：查任務代號（「任務代號是什麼」）

mutate（會改變資料，需要謹慎）：
- task_capture：記錄新任務。✅「記錄：繳電費」「幫我記一下開會」「待辦：買牛奶」❌ 不是 task_capture：「記得繳電費」「還要買牛奶」「明天要開會」「對了還要繳電費」— 沒有「記錄」「幫我記」「待辦」等明確指令
- task_completion：標記完成（「跑步完成了」「第一個做完了」「幫我標記完成」）
- classification：調整分類（「把 XXX 移到 OOO」）
- reorganize：整理結構（「幫我整理任務」）

meta：
- planning：拆解規劃（「幫我規劃 XXX」）
- greeting：打招呼（「你好」「嗨」「你是誰」）
- unknown：不屬於以上任何 intent

## speechAct 使用指引

- query：用戶在查資料
- mutate：用戶要改資料
- clarify：用戶在否定、澄清、補充（「不是」「只是跟你說一下」「我是說那個」）
- confirm：用戶在確認（「對」「確認」「好的，執行」）
- meta：其他（打招呼、閒聊、問能力）

## Confidence 校準

- 0.95-1.0：完全明確，語意零歧義（「記錄：繳電費」→ task_capture 0.96）
- 0.80-0.94：高度可能，但有微小歧義（「跑步完成了」→ task_completion 0.85）
- 0.50-0.79：可能，但需要確認（「記得繳電費」→ 可能是 task_capture 也可能是提醒 → unknown 0.60）
- <0.50：不確定（「嗯」→ unknown 0.20）

## 核心原則

1. task_capture 是高風險 mutation — 一旦判錯就會建立垃圾任務。必須有明確記錄框架（「記錄」「幫我記」「待辦」「todo」）才能判 task_capture。缺少框架的陳述句一律 unknown。
2. 高風險 mutation（task_capture、task_completion）寧可保守。不確定就 unknown + 低 confidence。
3. 多輪上下文：session summary 和 memory 可用於理解指代（「那個」「第一個」），但不能改變這一句本身的語意。用戶在前一輪記了東西，不代表這一輪也要記。
4. reasonCodes 使用短的 machine-readable 字串。`

export function createZentropyAgent(userId: string, lineUserId?: string): LifecycleAwareAgent {
  const rawRuntime = getAgentRuntime()
  const guardrails = buildExperimentalGuardrails()
  const chatModel = getAgentChatModel()
  const summaryModel = getAgentSummaryModel()

  // confirmationKey: LINE 用 lineUserId，API 用 api:{userId}
  // 確保所有路徑都有 session-based confirm 流程
  const confirmationKey = lineUserId ?? `api:${userId}`

  const runtime: AgentRuntimeParts = {
    sessionStore: rawRuntime.sessionStore,
    summaryStore: rawRuntime.summaryStore,
    memoryManager: rawRuntime.memoryManager,
    longTermMemoryMode: rawRuntime.longTermMemoryMode,
    chatModel,
    summaryModel,
    guardrails,
  }

  const skills = [
    createBrainDumpSkill(userId),
    createReorganizeSkill(userId),
    createPlannerSkill(userId),
    createQueryTasksSkill(userId),
    createCompleteTaskSkill(userId, confirmationKey),
    createAdjustTagsSkill(userId, confirmationKey),
  ]

  const baseAgent = createResponseAgent(runtime, skills)

  const decisionAgent = createDecisionFallbackAgent(runtime)

  const intentResolver = new StructuredFallbackAgentIntentResolver({
    decisionAgent,
    model: chatModel,
    classifier: new LLMStructuredClassifier<AgentIntent>({
      name: "zentropy-agent-intent-v1",
      model: chatModel,
      schema: AgentIntentSchema,
      systemPrompt: DECISION_PROMPT,
    }),
  })

  const executor = new IntentAwareExecutor({
    model: chatModel,
    userId,
    lineUserId: confirmationKey,
  })

  const agent = getAgentRoutingMode() === "tool_first"
    ? new ToolFirstAgent({
        executor,
        delegate: baseAgent,
        sessionStore: rawRuntime.sessionStore,
        metaStore: rawRuntime.metaStore,
        memoryManager: rawRuntime.longTermMemoryMode === "each_turn" ? rawRuntime.memoryManager : null,
        lineUserId: confirmationKey,
        intentResolver,
      })
    : baseAgent

  return new LifecycleAwareAgent(agent, rawRuntime.lifecycleService, userId)
}
