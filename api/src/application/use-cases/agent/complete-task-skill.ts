/**
 * CompleteTaskSkill — 完成任務 check-off
 *
 * 觸發詞：完成、做完、搞定、done、完成了、已完成
 * 語意搜尋最相似任務 → 確認訊息 → 存 session → 等用戶確認
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getEmbedding, cosineSimilarity } from "@/lib/embedding"
import { saveLineSession } from "@/lib/line-session"
import type { CompleteTaskPayload } from "@/lib/line-session"
import { CompleteTaskUseCase } from "@/application/use-cases/tasks/complete-task"

const MAX_TASK_SEARCH_POOL = 150
const MAX_EMBEDDING_CANDIDATES = 40

interface SearchableTask {
  id: string
  content: string
}

const createCompleteTaskSearchTool = (userId: string, lineUserId?: string) =>
  tool({
    name: "complete_task_search",
    description: "搜尋用戶想要標記為完成的任務，回傳候選清單並等待確認",
    parameters: z.object({
      taskName: z.string().describe("用戶描述的任務名稱或關鍵字"),
    }),
    execute: async ({ taskName }) => {
      const completeTaskUseCase = new CompleteTaskUseCase()

      // 先擴大召回，再透過文字預篩縮小 embedding 候選
      const tasks = await prisma.task.findMany({
        where: { user_id: userId, status: "ACTIVE", deleted_at: null },
        select: { id: true, content: true },
        take: MAX_TASK_SEARCH_POOL,
        orderBy: { updated_at: "desc" },
      })

      if (tasks.length === 0) return "目前沒有進行中的任務。"

      const candidateTasks = pickSearchCandidates(taskName, tasks)

      // 逐個生成 embedding（避免並行 embedding API 呼叫導致 rate-limit）
      const queryEmb = await getEmbedding(taskName)
      const scored = []
      for (const t of candidateTasks) {
        const emb = await getEmbedding(t.content)
        scored.push({ ...t, score: cosineSimilarity(queryEmb, emb) })
      }

      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, 3).filter((t) => t.score > 0.5)

      if (top.length === 0) {
        return `找不到與「${taskName}」相關的任務，請確認任務名稱。`
      }

      const best = top[0]

      if (!lineUserId) {
        // REST API 模式：直接完成，不需要 LINE session 確認
        await completeTaskUseCase.execute({
          taskId: best.id,
          userId,
        })
        return `✅ 已完成「${best.content}」，任務已封存。`
      }

      // LINE Bot 模式：存 session，等待確認
      // 單一高信心結果 → 直接存 session
      if (top.length === 1 || top[0].score > 0.8) {
        const payload: CompleteTaskPayload = { taskId: best.id, taskTitle: best.content }
        await saveLineSession(lineUserId, "complete_task_confirm", payload)
        return `是否完成「${best.content}」？\n\n回覆「確認」執行，或無視此訊息取消。`
      }

      // 多筆候選 → 列出讓用戶選擇（存第一個）
      const payload: CompleteTaskPayload = { taskId: top[0].id, taskTitle: top[0].content }
      await saveLineSession(lineUserId, "complete_task_confirm", payload)
      const list = top.map((t, i) => `${i + 1}. ${t.content}`).join("\n")
      return `找到多個相關任務：\n\n${list}\n\n預設完成第 1 筆，回覆「確認」執行，或無視此訊息取消。`
    },
  })

export const createCompleteTaskSkill = (userId: string, lineUserId?: string) =>
  skill({
    name: "complete_task",
    description: "標記任務為完成",
    triggers: ["完成", "做完", "搞定", "done", "完成了", "已完成", "做好了", "結束了"],
    priority: 9,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想標記某個任務為完成。請使用 complete_task_search 工具，" +
          "提取用戶描述的任務名稱傳入。工具會搜尋並回傳確認訊息。",
        extraTools: [createCompleteTaskSearchTool(userId, lineUserId)],
        skillName: "complete_task",
      }),
  })

export function pickSearchCandidates(taskName: string, tasks: SearchableTask[]): SearchableTask[] {
  const ranked = tasks
    .map((task, index) => ({
      task,
      score: lexicalMatchScore(taskName, task.content),
      index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })

  const matched = ranked.filter((item) => item.score > 0).slice(0, MAX_EMBEDDING_CANDIDATES)
  if (matched.length > 0) {
    return matched.map((item) => item.task)
  }

  return tasks.slice(0, MAX_EMBEDDING_CANDIDATES)
}

export function lexicalMatchScore(taskName: string, content: string): number {
  const query = normalizeText(taskName)
  const target = normalizeText(content)
  if (!query || !target) return 0

  let score = 0

  if (target.includes(query)) {
    score += 10
  }

  for (const token of tokenize(query)) {
    if (target.includes(token)) {
      score += token.length >= 2 ? 4 : 1
    }
  }

  for (const bigram of bigrams(query)) {
    if (target.includes(bigram)) {
      score += 2
    }
  }

  return score
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s/,_-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0),
    ),
  )
}

function bigrams(text: string): string[] {
  const chars = Array.from(text.replace(/\s+/g, ""))
  const grams: string[] = []
  for (let i = 0; i < chars.length - 1; i += 1) {
    grams.push(chars[i] + chars[i + 1])
  }
  return Array.from(new Set(grams))
}
