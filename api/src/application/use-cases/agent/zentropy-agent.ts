/**
 * ZentropyAgent 工廠
 *
 * 組合 Skills + Model → NaruAgent（直接使用原版 naru-agent-js）
 */

import {
  NaruAgent,
  InMemorySessionStore,
  InMemorySummaryStore,
} from "naru-agent-js"
import { createMemoryManager } from "@/lib/naru-memory"
import { google } from "@ai-sdk/google"
import { createBrainDumpSkill } from "./brain-dump-skill"
import { createReorganizeSkill } from "./reorganize-skill"
import { createPlannerSkill } from "./planner-skill"
import { createQueryTasksSkill } from "./query-tasks-skill"
import { createAdjustTagsSkill } from "./adjust-tags-skill"
import { createCompleteTaskSkill } from "./complete-task-skill"

// Module-level singletons — 跨 request 持久
const sessionStore = new InMemorySessionStore()
const summaryStore = new InMemorySummaryStore()
const memoryManager = createMemoryManager()

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
- 查詢類問題只能根據工具結果回答；如果工具有說明查詢範圍限制、總數或只列出部分項目，你必須照實轉述
- 用戶問「今天完成了什麼」時，禁止改答成待辦清單；若工具只覆蓋部分來源，也必須明說
- 無法判斷用戶意圖時：直接問「你是要記錄這件事，還是要查詢/完成/規劃什麼？」，不要自行猜測後假裝執行
- 用戶輸入看起來像待辦事項或任務（動詞+事情，例如「去買東西」「回覆信件」「準備報告」）：直接呼叫 brain_dump 工具記錄，不需要確認`

export function createZentropyAgent(userId: string, lineUserId?: string): NaruAgent {
  return new NaruAgent({
    model: google("gemini-3.1-flash-lite-preview"),
    name: "naru",
    instructions: [SYSTEM_PROMPT],
    // Session（短期對話記憶）
    sessionStore,
    numHistoryMessages: 10,
    // Context 壓縮（超過 10 輪時壓縮舊對話，保留最後 5 輪）
    contextCompression: true,
    summaryStore,
    summaryModel: google("gemma-3-12b-it"),
    compressionThresholdRounds: 5,
    compressionKeepLastRounds: 5,
    // Long-term memory（LLM 萃取事實 + pgvector）
    memoryManager,
    skills: [
      createBrainDumpSkill(userId),
      createReorganizeSkill(userId),
      createPlannerSkill(userId),
      createQueryTasksSkill(userId),
      createCompleteTaskSkill(userId, lineUserId),
      createAdjustTagsSkill(userId, lineUserId),
    ],
  })
}
