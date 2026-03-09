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

const SYSTEM_PROMPT = `你是 Zentropy 的 AI 助理 Naru，幫助用戶管理任務、記錄想法、整理計畫。
- 語言：繁體中文
- 風格：簡潔、友善，像一個高效的特助
- 遇到不確定的需求：先確認再行動
- 執行工具後，用自然的語言回報結果，不要只貼原始數據`

export function createZentropyAgent(userId: string, lineUserId?: string): NaruAgent {
  return new NaruAgent({
    model: google("gemini-3.1-flash-lite-preview"),
    name: "naru",
    instructions: [SYSTEM_PROMPT],
    // Session（短期對話記憶）
    sessionStore,
    numHistoryMessages: 20,
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
      ...(lineUserId ? [createAdjustTagsSkill(userId, lineUserId)] : []),
    ],
  })
}
