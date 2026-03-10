/**
 * ZentropyAgent 工廠
 *
 * 組合 Skills + Model → NaruAgent（直接使用原版 naru-agent-js）
 */

import {
  LLMStructuredClassifier,
  NaruAgent,
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
import { GroqPromptGuardrail } from "@/application/services/groq-prompt-guardrail"
import { getAgentChatModel, getAgentRoutingMode, getAgentSummaryModel } from "@/lib/agent-model"

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

const SYSTEM_PROMPT = `你是 Zentropy 的 LINE Bot 助理，透過 LINE 訊息幫助用戶管理任務。

你能做的事（只能做這些，不能做其他）：
1. 記錄任務與想法（brain_dump）— 接收用戶描述，自動分類建立任務
2. 查詢今日任務（query_tasks）— 列出今天的待辦清單
3. 標記任務完成（complete_task）— 語意搜尋匹配，封存任務
4. 拆解目標為任務（planner）— 將大目標拆解成可執行的任務清單
5. 調整任務分類（adjust_tags）— 將任務移到不同 Product 或改變 Topic
6. 重整任務結構（reorganize）— 分析並提出任務合併/移動建議

你不能做的事（必須明確告知用戶）：
- 不能修改任務的標題或內容
- 不能刪除任務
- 不能設定或修改截止日期
- 不能查詢任務以外的 Zentropy 資料

規則：
- 語言：繁體中文
- 風格：簡潔直接，不廢話，像高效特助
- 用戶要求超出能力範圍時：明確說「這個我還做不到，目前只能 [列出相關能做的]」
- 執行 tool 後：用自然語言回報結果，不貼原始資料
- ⚠️ 絕對禁止：沒有呼叫工具就宣稱已完成操作（「已記錄」「已完成」等字眼，必須是工具真的執行完才能說）
- 查詢類問題只能根據工具結果回答；如果工具在 [FACTS] JSON 中說明查詢範圍限制、總數、群組摘要或只列出部分項目，你必須照實轉述
- 用戶問「今天完成了什麼」時，禁止改答成待辦清單；若工具只覆蓋部分來源，也必須明說
- 無法判斷用戶意圖時：直接問「你是要記錄這件事，還是要查詢/完成/規劃什麼？」，不要自行猜測後假裝執行
- 用戶輸入看起來像待辦事項或任務（動詞+事情，例如「去買東西」「回覆信件」「準備報告」）：直接呼叫 brain_dump 工具記錄，不需要確認`

const DECISION_PROMPT = `你是 Zentropy LINE Agent 的 decision layer。

你的唯一工作是判定 canonical intent。

規則：
- 輸出必須符合 schema，不要回答自然語言
- 只判斷使用者這一句的 intent，必要時可參考 session summary 與 memory
- 高風險 mutation 寧可保守，不要亂猜
- 不知道時回傳 object=unknown，confidence 低於 0.5
- reasonCodes 使用短的 machine-readable 字串`

export function createZentropyAgent(userId: string, lineUserId?: string): LifecycleAwareAgent {
  const runtime = getAgentRuntime()
  const guardrails = buildExperimentalGuardrails()
  const chatModel = getAgentChatModel()
  const summaryModel = getAgentSummaryModel()
  const baseAgent = new NaruAgent({
    model: chatModel,
    name: "naru",
    instructions: [SYSTEM_PROMPT],
    // Session（短期對話記憶）
    sessionStore: runtime.sessionStore,
    numHistoryMessages: 10,
    // Context 壓縮（超過 10 輪時壓縮舊對話，保留最後 5 輪）
    contextCompression: true,
    summaryStore: runtime.summaryStore,
    // 摘要模型跟主對話模型共用同一個 provider 封裝，未來替換只需要改 agent-model.ts。
    summaryModel,
    compressionThresholdRounds: 5,
    compressionKeepLastRounds: 5,
    memoryManager: runtime.longTermMemoryMode === "each_turn" ? runtime.memoryManager ?? undefined : undefined,
    guardrails,
    skills: [
      createBrainDumpSkill(userId),
      createReorganizeSkill(userId),
      createPlannerSkill(userId),
      createQueryTasksSkill(userId),
      createCompleteTaskSkill(userId, lineUserId),
      createAdjustTagsSkill(userId, lineUserId),
    ],
  })

  const decisionAgent = new NaruAgent({
    model: chatModel,
    name: "naru-decision",
    instructions: [DECISION_PROMPT],
    sessionStore: runtime.sessionStore,
    numHistoryMessages: 10,
    contextCompression: true,
    summaryStore: runtime.summaryStore,
    summaryModel,
    compressionThresholdRounds: 5,
    compressionKeepLastRounds: 5,
    memoryManager: runtime.longTermMemoryMode === "each_turn" ? runtime.memoryManager ?? undefined : undefined,
    guardrails,
  })

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

  const agent = getAgentRoutingMode() === "tool_first"
    ? new ToolFirstAgent({
        delegate: baseAgent,
        sessionStore: runtime.sessionStore,
        memoryManager: runtime.longTermMemoryMode === "each_turn" ? runtime.memoryManager : null,
        lineUserId,
        intentResolver,
      })
    : baseAgent

  return new LifecycleAwareAgent(agent, runtime.lifecycleService, userId)
}
