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
const MAX_DISPLAY_CANDIDATES = 3
const HIGH_CONFIDENCE_THRESHOLD = 0.8
const DISAMBIGUATION_GAP = 0.08

interface SearchableTask {
  id: string
  content: string
  productName?: string
  sourceType: "task" | "sub_task" | "daily_plan_item"
  taskId?: string
  subTaskId?: string
  planItemId?: string
}

interface RankedTaskMatch extends SearchableTask {
  lexicalScore: number
  semanticScore: number
  combinedScore: number
}

interface CompleteTaskSearchFacts {
  query: string
  totalActiveTasks: number
  candidateCount: number
  decision: "completed" | "awaiting_confirmation" | "needs_disambiguation" | "no_match"
  selectedTaskId?: string
  selectedTaskTitle?: string
  selectedSourceType?: SearchableTask["sourceType"]
  candidates: Array<{
    id: string
    title: string
    productName?: string
    sourceType: SearchableTask["sourceType"]
    lexicalScore: number
    semanticScore: number
    combinedScore: number
  }>
}

export const createCompleteTaskSearchTool = (
  userId: string,
  originalMessage: string,
  lineUserId?: string,
  resolvedQuery?: string,
) =>
  tool({
    name: "complete_task_search",
    description: "搜尋用戶想要標記為完成的任務，回傳候選清單並等待確認",
    // Groq function calling 會偶發把 schema 結構當成參數值回傳。
    // 這裡改成零參數工具，直接對使用者原句做任務搜尋，降低 provider 相容性風險。
    parameters: z.object({}),
    execute: async () => {
      const taskName = resolvedQuery ?? originalMessage
      const completeTaskUseCase = new CompleteTaskUseCase()

      const [tasks, subTasks, dailyPlanItems] = await Promise.all([
        prisma.task.findMany({
          where: { user_id: userId, status: "ACTIVE", deleted_at: null },
          select: {
            id: true,
            content: true,
            product: {
              select: {
                name: true,
              },
            },
          },
          take: MAX_TASK_SEARCH_POOL,
          orderBy: { updated_at: "desc" },
        }),
        prisma.subTask.findMany({
          where: {
            user_id: userId,
            deleted_at: null,
            completed: false,
            task: {
              deleted_at: null,
              status: "ACTIVE",
            },
          },
          select: {
            id: true,
            content: true,
            task_id: true,
            task: {
              select: {
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          take: MAX_TASK_SEARCH_POOL,
          orderBy: { updated_at: "desc" },
        }),
        prisma.dailyPlanItem.findMany({
          where: {
            completed: false,
            plan: {
              user_id: userId,
            },
          },
          select: {
            id: true,
            content: true,
            task_id: true,
            sub_task_id: true,
            product_name: true,
            plan: {
              select: {
                plan_date: true,
              },
            },
          },
          take: MAX_TASK_SEARCH_POOL,
          orderBy: [{ plan: { plan_date: "desc" } }, { updated_at: "desc" }],
        }),
      ])

      const openSubTaskIds = new Set(subTasks.map((subTask) => subTask.id))
      const searchableTasks: SearchableTask[] = [
        ...tasks.map((task) => ({
          id: task.id,
          content: task.content,
          productName: task.product?.name,
          sourceType: "task" as const,
          taskId: task.id,
        })),
        ...subTasks.map((subTask) => ({
          id: subTask.id,
          content: subTask.content,
          productName: subTask.task.product?.name,
          sourceType: "sub_task" as const,
          taskId: subTask.task_id,
          subTaskId: subTask.id,
        })),
        ...dailyPlanItems.map((item) => ({
          id: item.id,
          content: item.content,
          productName: item.product_name,
          sourceType: "daily_plan_item" as const,
          taskId: item.task_id,
          subTaskId: item.sub_task_id ?? undefined,
          planItemId: item.id,
        })).filter((item) => !item.subTaskId || !openSubTaskIds.has(item.subTaskId)),
      ]

      if (searchableTasks.length === 0) {
        return serializeCompleteTaskSearchResult({
          query: taskName,
          totalActiveTasks: 0,
          candidateCount: 0,
          decision: "no_match",
          candidates: [],
        }, "目前沒有進行中的任務。")
      }

      const ranked = await rankTaskMatches(taskName, searchableTasks)
      const top = ranked.slice(0, MAX_DISPLAY_CANDIDATES)
      const decision = decideTaskMatch(top)

      if (decision.type === "no_match") {
        return serializeCompleteTaskSearchResult(
          buildSearchFacts(taskName, searchableTasks.length, top, "no_match"),
          `找不到與「${taskName}」相關的任務。請提供更精確的任務名稱或關鍵字，讓我判斷候選任務。`,
        )
      }

      if (!lineUserId) {
        if (decision.type !== "selected") {
          return serializeCompleteTaskSearchResult(
            buildSearchFacts(taskName, searchableTasks.length, top, "needs_disambiguation"),
            buildDisambiguationMessage(taskName, top),
          )
        }

        if (decision.task.sourceType !== "task" || !decision.task.taskId) {
          return serializeCompleteTaskSearchResult(
            buildSearchFacts(taskName, searchableTasks.length, top, "needs_disambiguation"),
            "LINE 以外目前只支援直接完成 Task。請改用 LINE 確認流程，或提供更精確的 Task 名稱。",
          )
        }

        await completeTaskUseCase.execute({ taskId: decision.task.taskId, userId })
        return serializeCompleteTaskSearchResult(
          buildSearchFacts(taskName, searchableTasks.length, top, "completed", decision.task),
          `✅ 已完成「${decision.task.content}」，任務已封存。`,
        )
      }

      if (decision.type === "selected") {
        const payload: CompleteTaskPayload = {
          sourceType: decision.task.sourceType,
          taskTitle: decision.task.content,
          taskId: decision.task.taskId,
          subTaskId: decision.task.subTaskId,
          planItemId: decision.task.planItemId,
        }
        await saveLineSession(lineUserId, "complete_task_confirm", payload)
        return serializeCompleteTaskSearchResult(
          buildSearchFacts(taskName, searchableTasks.length, top, "awaiting_confirmation", decision.task),
          `是否完成「${decision.task.content}」？\n\n回覆「確認」執行，或無視此訊息取消。`,
        )
      }

      return serializeCompleteTaskSearchResult(
        buildSearchFacts(taskName, searchableTasks.length, top, "needs_disambiguation"),
        buildDisambiguationMessage(taskName, top),
      )
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
          "用戶想標記某個任務為完成。請直接呼叫 complete_task_search 工具。" +
          "工具會使用用戶原句做搜尋。先讀取工具回傳的 [FACTS] JSON 區塊，再根據後面的摘要回答。" +
          "若 FACTS 顯示 needs_disambiguation 或 no_match，不得假裝已完成，必須要求用戶確認更精確的任務。" +
          "這類澄清回覆必須明確包含「找不到」以及「更精確的任務名稱」或「任務名稱」等字樣，不能只說籠統的錯誤。",
        extraTools: [createCompleteTaskSearchTool(userId, _message, lineUserId)],
        skillName: "complete_task",
      }),
  })

async function rankTaskMatches(taskName: string, tasks: SearchableTask[]): Promise<RankedTaskMatch[]> {
  const candidates = pickSearchCandidates(taskName, tasks)
  if (candidates.length === 0) return []

  const strongLexicalMatches = candidates
    .map((task) => ({
      task,
      lexicalScore: lexicalMatchScore(taskName, task.content),
    }))
    .filter((item) => item.lexicalScore >= 10)

  if (strongLexicalMatches.length === 1) {
    return [{
      ...strongLexicalMatches[0].task,
      lexicalScore: strongLexicalMatches[0].lexicalScore,
      semanticScore: 1,
      combinedScore: 1,
    }]
  }

  const queryEmb = await getEmbedding(taskName)
  const ranked: RankedTaskMatch[] = []
  for (const task of candidates) {
    const emb = await getEmbedding(task.content)
    const semanticScore = cosineSimilarity(queryEmb, emb)
    const lexicalScore = lexicalMatchScore(taskName, task.content)
    ranked.push({
      ...task,
      lexicalScore,
      semanticScore,
      combinedScore: combineMatchScores(lexicalScore, semanticScore),
    })
  }

  return ranked
    .filter((task) => task.combinedScore >= 0.45)
    .sort((lhs, rhs) => rhs.combinedScore - lhs.combinedScore)
}

function buildSearchFacts(
  taskName: string,
  totalActiveTasks: number,
  candidates: RankedTaskMatch[],
  decision: CompleteTaskSearchFacts["decision"],
  selectedTask?: RankedTaskMatch,
): CompleteTaskSearchFacts {
  return {
    query: taskName,
    totalActiveTasks,
    candidateCount: candidates.length,
    decision,
    selectedTaskId: selectedTask?.id,
    selectedTaskTitle: selectedTask?.content,
    selectedSourceType: selectedTask?.sourceType,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.content,
      productName: candidate.productName,
      sourceType: candidate.sourceType,
      lexicalScore: roundScore(candidate.lexicalScore),
      semanticScore: roundScore(candidate.semanticScore),
      combinedScore: roundScore(candidate.combinedScore),
    })),
  }
}

function serializeCompleteTaskSearchResult(facts: CompleteTaskSearchFacts, summary: string): string {
  return ["[FACTS]", JSON.stringify(facts, null, 2), "[/FACTS]", "", summary].join("\n")
}

function buildDisambiguationMessage(taskName: string, candidates: RankedTaskMatch[]): string {
  if (candidates.length === 0) {
    return `找不到與「${taskName}」相關的任務。請提供更精確的任務名稱或關鍵字，讓我判斷候選任務。`
  }

  const list = candidates
    .map((candidate, index) => `${index + 1}. ${candidate.content}${candidate.productName ? ` [${candidate.productName}]` : ""}`)
    .join("\n")
  return `找到多個可能的候選任務，但目前不足以安全判定要完成哪一筆：\n\n${list}\n\n請直接回覆更精確的任務名稱。`
}

function combineMatchScores(lexicalScore: number, semanticScore: number): number {
  const lexicalComponent = Math.min(lexicalScore / 18, 1)
  return lexicalComponent * 0.45 + semanticScore * 0.55
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000
}

export function decideTaskMatch(
  candidates: RankedTaskMatch[],
): { type: "no_match" } | { type: "selected"; task: RankedTaskMatch } | { type: "disambiguation" } {
  if (candidates.length === 0) {
    return { type: "no_match" }
  }

  const [best, second] = candidates
  if (!best) {
    return { type: "no_match" }
  }

  if (best.combinedScore >= HIGH_CONFIDENCE_THRESHOLD && (!second || best.combinedScore - second.combinedScore >= DISAMBIGUATION_GAP)) {
    return { type: "selected", task: best }
  }

  if (best.lexicalScore >= 10 && (!second || best.lexicalScore - second.lexicalScore >= 6)) {
    return { type: "selected", task: best }
  }

  return { type: "disambiguation" }
}

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
