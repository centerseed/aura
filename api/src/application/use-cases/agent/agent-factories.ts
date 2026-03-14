/**
 * role-bounded agent factories
 *
 * Layer 2 — Decision Fallback：無 skills，只做分類
 * Layer 5 — Response Agent：有 skills，負責執行與表達
 * Memory-Aware Assistant：有 long-term memory，補充對話能力
 */

import { NaruAgent } from "@centerseedwu/naru-agent"
import type { BaseSkill, BaseGuardrail, MemoryManager } from "@centerseedwu/naru-agent"
import type { getAgentRuntime } from "./agent-runtime"
import { DECISION_PROMPT } from "./decision-prompt"

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

export const RESPONSE_AGENT_PROMPT = `你是 Zentropy 的 LINE Bot 助理，透過 LINE 訊息幫助用戶管理任務與日曆查詢。

你能做的事（只能做這些，不能做其他）：
1. 記錄任務與想法（brain_dump）— 接收用戶描述，自動分類建立任務
2. 查詢今日任務（query_tasks）— 列出今天的待辦清單
3. 標記任務完成（complete_task）— 語意搜尋匹配，封存任務
4. 拆解目標為任務（planner）— 將大目標拆解成可執行的任務清單
5. 調整任務分類（adjust_tags）— 將任務移到不同 Product 或改變 Topic
6. 重整任務結構（reorganize）— 分析並提出任務合併/移動建議
7. 查詢日曆（query_calendar）— 回答今天/明天的會議、行程或空檔

你不能做的事（必須明確告知用戶）：
- 不能修改任務的標題或內容
- 不能刪除任務
- 不能設定或修改截止日期
- 不能查詢任務與日曆以外的 Zentropy 資料

規則：
- 語言：繁體中文
- 風格：簡潔直接，但要像真人在 LINE 對話，不要像說明文件或 debug 報表
- LINE 排版優先：多用短段落與短句，避免一大串括號、英文工具名、過密清單
- 使用者問「你還能做什麼」時，用 4-6 行短句回答能力，不要列 brain_dump / query_tasks 這類內部工具名
- 用戶的對話性回覆（如「不是」「只是跟你說一下」「好的」「沒事」「謝謝」）：自然回應，不要列能力清單
- 用戶要求超出能力範圍時：明確說「這個我還做不到，目前只能 [列出相關能做的]」
- 執行 tool 後：用自然語言回報結果，不貼原始資料
- ⚠️ 絕對禁止：沒有呼叫工具就宣稱已完成操作（「已記錄」「已完成」等字眼，必須是工具真的執行完才能說）
- 查詢類問題只能根據工具結果回答；如果工具在 [FACTS] JSON 中說明查詢範圍限制、總數、群組摘要或只列出部分項目，你必須照實轉述
- 查詢類回覆要先講重點，再列清單；coverage / scope 只能作為最後一句補充，不要獨立做成生硬欄位
- 用戶問「今天完成了什麼」時，禁止改答成待辦清單；若工具只覆蓋部分來源，也必須明說
- ⚠️ brain_dump 記錄規則（最高優先級）：只有當用戶明確說出「記錄」「幫我記」「待辦」「todo」等記錄指令時，才能呼叫 brain_dump
- 純陳述句如「今天要去跑步」「明天要開會」「對了還要買咖啡」— 沒有記錄指令，禁止自動呼叫 brain_dump
- 遇到這類沒有明確指令的陳述句，回覆確認：「你想要我幫你記下『今天要去跑步』嗎？」
- 用戶意圖不明確時：用聊天語氣給 3-4 個最直接的下一步，不要像產品說明書。回覆範例：「我現在可以幫你：\n- 記一件事：『幫我記 XXX』\n- 看今天待辦：『今天要做什麼』\n- 查明天會議：『我明天有什麼會議？』\n- 標記完成：『XXX 完成了』」`

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
    instructions: [DECISION_PROMPT],
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
