/**
 * role-bounded agent factories
 *
 * Layer 2 — Decision Fallback：無 skills，只做分類
 * Layer 5 — Response Agent：有 skills，負責執行與表達
 * Memory-Aware Assistant：有 long-term memory，補充對話能力
 */

import { NaruAgent } from "naru-agent-js"
import type { BaseSkill, BaseGuardrail, MemoryManager } from "naru-agent-js"
import type { getAgentRuntime } from "./agent-runtime"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentRuntimeParts {
  sessionStore: ReturnType<typeof getAgentRuntime>["sessionStore"]
  summaryStore: ReturnType<typeof getAgentRuntime>["summaryStore"]
  memoryManager: MemoryManager | null
  longTermMemoryMode: string
  chatModel: ReturnType<typeof import("@/lib/agent-model").getAgentChatModel>
  summaryModel: ReturnType<typeof import("@/lib/agent-model").getAgentSummaryModel>
  guardrails?: BaseGuardrail[]
}

// ── Role-Specific Prompts ─────────────────────────────────────────────────────

const DECISION_FALLBACK_PROMPT = `你是 Zentropy LINE Agent 的 decision layer。

你的唯一工作是判定 canonical intent。

可能的 intent：
- query > today_focus：查詢今天待辦（「今天要做什麼」「有什麼任務」）
- query > completed_today：查詢今天完成項目（「今天完成了什麼」）
- mutate > task_capture：記錄任務（必須有明確記錄指令如「記錄」「待辦」「幫我記」）
- mutate > task_completion：標記完成（「XXX 完成了」「幫我標記完成」）
- mutate > classification：調整分類（「把 XXX 移到 OOO」）
- mutate > reorganize：整理結構（「幫我整理任務」）
- meta > planning：拆解規劃（「幫我規劃 XXX」）
- meta > unknown：無法判斷

核心原則：
1. task_capture 必須有明確記錄意圖——「記錄：XXX」「幫我記一下 XXX」「待辦：XXX」才算
2. 純陳述句如「今天要去跑步」「明天要開會」沒有請求記錄 → unknown
3. 高風險 mutation（完成、刪除）寧可保守，不確定就 unknown
4. 真正不確定時：object="unknown"，confidence < 0.5

規則：
- 輸出必須符合 schema，不要回答自然語言
- 只判斷使用者這一句的 intent，必要時可參考 session summary 與 memory
- reasonCodes 使用短的 machine-readable 字串`

export const RESPONSE_AGENT_PROMPT = `你是 Zentropy 的 LINE Bot 助理，透過 LINE 訊息幫助用戶管理任務。

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
- 用戶的對話性回覆（如「不是」「只是跟你說一下」「好的」「沒事」「謝謝」）：自然回應，不要列能力清單
- 用戶要求超出能力範圍時：明確說「這個我還做不到，目前只能 [列出相關能做的]」
- 執行 tool 後：用自然語言回報結果，不貼原始資料
- ⚠️ 絕對禁止：沒有呼叫工具就宣稱已完成操作（「已記錄」「已完成」等字眼，必須是工具真的執行完才能說）
- 查詢類問題只能根據工具結果回答；如果工具在 [FACTS] JSON 中說明查詢範圍限制、總數、群組摘要或只列出部分項目，你必須照實轉述
- 用戶問「今天完成了什麼」時，禁止改答成待辦清單；若工具只覆蓋部分來源，也必須明說
- ⚠️ brain_dump 記錄規則（最高優先級）：只有當用戶明確說出「記錄」「幫我記」「待辦」「todo」等記錄指令時，才能呼叫 brain_dump
- 純陳述句如「今天要去跑步」「明天要開會」「對了還要買咖啡」— 沒有記錄指令，禁止自動呼叫 brain_dump
- 遇到這類沒有明確指令的陳述句，回覆確認：「你想要我記錄『今天要去跑步』嗎？請說『記錄：今天要去跑步』」
- 用戶意圖不明確時：列出可能的動作讓用戶選擇，回覆範例：「你想要我做什麼呢？\n1. 記錄：說『記錄：XXX』\n2. 查詢今日任務：說『今天要做什麼』\n3. 標記完成：說『XXX 完成了』\n4. 調整分類：說『把這個任務移到 OOO』」`

const MEMORY_AWARE_ASSISTANT_PROMPT = `你是 Zentropy 的對話助理，具備長期記憶能力。

你可以根據用戶的歷史對話與記憶，提供個人化的回覆與建議。
語言：繁體中文。風格：簡潔、貼近用戶習慣。`

// ── Session/Compression 共用設定 ───────────────────────────────────────────────

const COMPRESSION_CONFIG = {
  contextCompression: true,
  compressionThresholdRounds: 5,
  compressionKeepLastRounds: 5,
  numHistoryMessages: 10,
} as const

// ── Factories ─────────────────────────────────────────────────────────────────

/**
 * Layer 2 — Decision Fallback Agent
 * 無 skills，只負責 intent 分類。
 */
export function createDecisionFallbackAgent(runtime: AgentRuntimeParts): NaruAgent {
  return new NaruAgent({
    model: runtime.chatModel,
    name: "naru-decision",
    instructions: [DECISION_FALLBACK_PROMPT],
    sessionStore: runtime.sessionStore,
    summaryStore: runtime.summaryStore,
    summaryModel: runtime.summaryModel,
    ...COMPRESSION_CONFIG,
    memoryManager: runtime.longTermMemoryMode === "each_turn" ? runtime.memoryManager ?? undefined : undefined,
    guardrails: runtime.guardrails,
  })
}

/**
 * Layer 5 — Response Agent
 * 帶 skills，負責執行操作與組織回覆。
 */
export function createResponseAgent(runtime: AgentRuntimeParts, skills: BaseSkill[]): NaruAgent {
  return new NaruAgent({
    model: runtime.chatModel,
    name: "naru",
    instructions: [RESPONSE_AGENT_PROMPT],
    sessionStore: runtime.sessionStore,
    summaryStore: runtime.summaryStore,
    summaryModel: runtime.summaryModel,
    ...COMPRESSION_CONFIG,
    memoryManager: runtime.longTermMemoryMode === "each_turn" ? runtime.memoryManager ?? undefined : undefined,
    guardrails: runtime.guardrails,
    skills,
  })
}

/**
 * Memory-Aware Assistant
 * 帶長期記憶，用於補充對話能力。
 */
export function createMemoryAwareAssistant(runtime: AgentRuntimeParts): NaruAgent {
  return new NaruAgent({
    model: runtime.chatModel,
    name: "naru-memory",
    instructions: [MEMORY_AWARE_ASSISTANT_PROMPT],
    sessionStore: runtime.sessionStore,
    summaryStore: runtime.summaryStore,
    summaryModel: runtime.summaryModel,
    ...COMPRESSION_CONFIG,
    memoryManager: runtime.memoryManager ?? undefined,
    guardrails: runtime.guardrails,
  })
}
