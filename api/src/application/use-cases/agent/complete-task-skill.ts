/**
 * CompleteTaskSkill — 完成任務 check-off
 *
 * 觸發詞：完成、做完、搞定、done、完成了、已完成
 * 正規化 + lexical matching 找候選 → deterministic 單輪完成或要求澄清
 */

import { tool, skill, makeSkillResult } from "@centerseedwu/naru-agent"
import { z } from "zod"
import { prisma } from "@/lib/db"
import type { CompleteTaskPayload } from "@/lib/line-session"
import { saveLineSession } from "@/lib/line-session"
import { serializeFactsSummary } from "./tool-result-protocol"
import { normalizeCompletionQueryText, resolveCompletionQuery } from "./completion-query-normalizer"
import { buildCompleteTaskSuccessMessage, executeCompleteTaskPayload } from "./complete-task-executor"

const MAX_TASK_SEARCH_POOL = 150
const MAX_LEXICAL_CANDIDATES = 5
const MAX_DISPLAY_CANDIDATES = 3
const HIGH_CONFIDENCE_THRESHOLD = 0.78
const DISAMBIGUATION_GAP = 0.12
const EXACT_MATCH_SCORE = 100
const STRONG_LEXICAL_SCORE = 78
const MIN_CANDIDATE_SCORE = 20

const DICE_WEIGHT = 0.55
const LEVENSHTEIN_WEIGHT = 0.3
const CONTAINMENT_WEIGHT = 0.15

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
  combinedScore: number
}

interface CompleteTaskSearchFacts {
  query: string
  totalActiveTasks: number
  candidateCount: number
  decision: "completed" | "awaiting_confirmation" | "needs_confirmation" | "needs_disambiguation" | "no_match"
  selectedTaskId?: string
  selectedTaskTitle?: string
  selectedSourceType?: SearchableTask["sourceType"]
  candidates: Array<{
    id: string
    title: string
    productName?: string
    sourceType: SearchableTask["sourceType"]
    lexicalScore: number
    combinedScore: number
  }>
  presentedEntities: Array<{
    position: number
    title: string
    entityId: string
    entityType: SearchableTask["sourceType"]
    taskId?: string
    subTaskId?: string
    planItemId?: string
  }>
}

async function executeCompleteTaskSearch(
  userId: string,
  taskName: string,
  lineUserId?: string,
  requireConfirmation = false,
): Promise<string> {
      const resolvedTaskName = await resolveCompletionQuery(taskName)
      const searchQuery = resolvedTaskName || taskName
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
          presentedEntities: [],
        }, "目前沒有進行中的任務。")
      }

      const ranked = await rankTaskMatches(searchQuery, searchableTasks)
      const top = ranked.slice(0, MAX_DISPLAY_CANDIDATES)
      const decision = decideTaskMatch(top)

      if (decision.type === "no_match") {
        return serializeCompleteTaskSearchResult(
          buildSearchFacts(searchQuery, searchableTasks.length, top, "no_match"),
          `找不到任何名為「${searchQuery}」的任務。請確認名稱，或直接告訴我是清單中的哪一個。`,
        )
      }

      if (decision.type === "selected") {
        const payload = toCompleteTaskPayload(decision.task)
        if (requireConfirmation) {
          await persistCompletionConfirmation(lineUserId, payload)
          return serializeCompleteTaskSearchResult(
            buildSearchFacts(searchQuery, searchableTasks.length, top, "awaiting_confirmation", decision.task),
            buildCompletionConfirmationPrompt(decision.task.content),
          )
        }
        await executeCompleteTaskPayload(userId, payload)
        return serializeCompleteTaskSearchResult(
          buildSearchFacts(searchQuery, searchableTasks.length, top, "completed", decision.task),
          buildCompleteTaskSuccessMessage(decision.task.content),
        )
      }

      if (top.length === 1) {
        const [candidate] = top
        if (candidate) {
          const payload = toCompleteTaskPayload(candidate)
          if (requireConfirmation) {
            await persistCompletionConfirmation(lineUserId, payload)
            return serializeCompleteTaskSearchResult(
              buildSearchFacts(searchQuery, searchableTasks.length, top, "awaiting_confirmation", candidate),
              buildCompletionConfirmationPrompt(candidate.content),
            )
          }
          await executeCompleteTaskPayload(userId, payload)

          return serializeCompleteTaskSearchResult(
            buildSearchFacts(searchQuery, searchableTasks.length, top, "completed", candidate),
            buildCompleteTaskSuccessMessage(candidate.content),
          )
        }
      }

      return serializeCompleteTaskSearchResult(
        buildSearchFacts(searchQuery, searchableTasks.length, top, "needs_disambiguation"),
        buildDisambiguationMessage(searchQuery, top),
      )
}

export const createCompleteTaskSearchTool = (
  userId: string,
  originalMessage: string,
  lineUserId?: string,
  resolvedQuery?: string,
  requireConfirmation = false,
) =>
  tool({
    name: "complete_task_search",
    description: "搜尋用戶想要標記為完成的任務，回傳候選清單並等待確認",
    // Groq function calling 會偶發把 schema 結構當成參數值回傳。
    // 這裡改成零參數工具，直接對使用者原句做任務搜尋，降低 provider 相容性風險。
    parameters: z.object({}),
    execute: async () => executeCompleteTaskSearch(userId, resolvedQuery ?? originalMessage, lineUserId, requireConfirmation),
  })

export const createParameterizedCompleteTaskSearchTool = (
  userId: string,
  lineUserId?: string,
  requireConfirmation = false,
) =>
  tool({
    name: "complete_task_search",
    description: "搜尋用戶想要標記為完成的任務。傳入任務名稱或關鍵字進行搜尋。",
    parameters: z.object({
      query: z.string().describe("要完成的任務名稱或關鍵字"),
    }),
    execute: async ({ query }) => executeCompleteTaskSearch(userId, query, lineUserId, requireConfirmation),
  })

export const createCompleteTaskSkill = (userId: string, lineUserId?: string) =>
  skill({
    name: "complete_task",
    description: "標記任務為完成",
    triggers: [],
    priority: 9,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想標記某個任務為完成。請呼叫 complete_task_search 工具，" +
          "從用戶訊息中提取任務名稱關鍵字傳入 query 參數。" +
          "範例：用戶說「跑步完成了」→ query = \"跑步\"。" +
          "先讀取工具回傳的 [FACTS] JSON 區塊，再根據後面的摘要回答。" +
          "若 FACTS 顯示 needs_disambiguation 或 no_match，不得假裝已完成，必須要求用戶確認更精確的任務。" +
          "這類澄清回覆必須明確包含「找不到」以及「更精確的任務名稱」或「任務名稱」等字樣，不能只說籠統的錯誤。",
        extraTools: [createParameterizedCompleteTaskSearchTool(userId, lineUserId)],
        skillName: "complete_task",
      }),
  })

async function persistCompletionConfirmation(
  lineUserId: string | undefined,
  payload: CompleteTaskPayload,
): Promise<void> {
  if (!lineUserId) return
  await saveLineSession(lineUserId, "complete_task_confirm", payload)
}

function buildCompletionConfirmationPrompt(taskTitle: string): string {
  return `你是要把「${taskTitle}」標記為完成嗎？`
}

async function rankTaskMatches(taskName: string, tasks: SearchableTask[]): Promise<RankedTaskMatch[]> {
  const normalizedQuery = normalizeCompletionQueryText(taskName)
  const candidates = pickSearchCandidates(normalizedQuery, tasks)
  if (candidates.length === 0) return []

  const lexicalRanked = candidates
    .map((task) => ({
      task,
      lexicalScore: lexicalMatchScore(normalizedQuery, task.content),
    }))
    .sort((lhs, rhs) => rhs.lexicalScore - lhs.lexicalScore)

  const strongLexicalMatches = lexicalRanked
    .filter((item) => item.lexicalScore >= EXACT_MATCH_SCORE)

  if (strongLexicalMatches.length === 1) {
    return [{
      ...strongLexicalMatches[0].task,
      lexicalScore: strongLexicalMatches[0].lexicalScore,
      combinedScore: 1,
    }]
  }

  const ranked = lexicalRanked.map(({ task, lexicalScore }) => ({
      ...task,
      lexicalScore,
      combinedScore: combineMatchScores(lexicalScore),
    }))

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
      combinedScore: roundScore(candidate.combinedScore),
    })),
    presentedEntities: decision === "needs_disambiguation"
      ? candidates.map((candidate, index) => ({
          position: index + 1,
          title: candidate.content,
          entityId: candidate.id,
          entityType: candidate.sourceType,
          taskId: candidate.taskId,
          subTaskId: candidate.subTaskId,
          planItemId: candidate.planItemId,
        }))
      : [],
  }
}

function serializeCompleteTaskSearchResult(facts: CompleteTaskSearchFacts, summary: string): string {
  return serializeFactsSummary(facts as unknown as Record<string, unknown>, summary)
}

export function buildDisambiguationMessage(taskName: string, candidates: RankedTaskMatch[]): string {
  if (candidates.length === 0) {
    return `找不到任何名為「${taskName}」的任務。請確認名稱，或直接告訴我是清單中的哪一個。`
  }

  if (candidates.length === 1) {
    const [candidate] = candidates
    const label = `${candidate.content}${candidate.productName ? ` [${candidate.productName}]` : ""}`
    return `我只找到一個可能的任務，但還不能完全確定是這個：\n\n1. ${label}\n\n你可以直接回覆 1，或回覆更完整的任務名稱。`
  }

  const list = candidates
    .map((candidate, index) => `${index + 1}. ${candidate.content}${candidate.productName ? ` [${candidate.productName}]` : ""}`)
    .join("\n")
  return `我找到多個可能的任務，請告訴我是下面哪一個：\n\n${list}\n\n你可以直接回覆序號，或回覆完整任務名稱。`
}

function combineMatchScores(lexicalScore: number): number {
  if (lexicalScore >= EXACT_MATCH_SCORE) return 1
  return Math.min(lexicalScore / 100, 1)
}

function toCompleteTaskPayload(task: RankedTaskMatch): CompleteTaskPayload {
  return {
    sourceType: task.sourceType,
    taskTitle: task.content,
    taskId: task.taskId,
    subTaskId: task.subTaskId,
    planItemId: task.planItemId,
  }
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

  if (best.lexicalScore >= EXACT_MATCH_SCORE) {
    return { type: "selected", task: best }
  }

  if (best.lexicalScore >= STRONG_LEXICAL_SCORE && (!second || best.lexicalScore - second.lexicalScore >= 12)) {
    return { type: "selected", task: best }
  }

  return { type: "disambiguation" }
}

export function pickSearchCandidates(taskName: string, tasks: SearchableTask[]): SearchableTask[] {
  const normalizedQuery = normalizeCompletionQueryText(taskName)
  const dedupedTasks = dedupeSearchableTasks(tasks)
  const ranked = dedupedTasks
    .map((task, index) => ({
      task,
      score: lexicalMatchScore(normalizedQuery, task.content),
      index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })

  const matched = ranked.filter((item) => item.score >= MIN_CANDIDATE_SCORE).slice(0, MAX_LEXICAL_CANDIDATES)
  if (matched.length > 0) {
    return matched.map((item) => item.task)
  }

  return []
}

export function lexicalMatchScore(taskName: string, content: string): number {
  const query = normalizeCompletionQueryText(taskName)
  const target = normalizeCompletionQueryText(content)
  const compactQuery = compactNormalizeText(query)
  const compactTarget = compactNormalizeText(content)
  if (!query || !target) return 0

  if (query === target || (compactQuery && compactQuery === compactTarget)) {
    return EXACT_MATCH_SCORE
  }

  const dice = diceCoefficient(compactQuery, compactTarget)
  const levenshtein = normalizedLevenshteinSimilarity(compactQuery, compactTarget)
  const containmentScore = containmentSimilarity(compactQuery, compactTarget)
  const unorderedTokenScore = unorderedTokenSimilarity(compactQuery, compactTarget)

  const weightedScore = (
    dice * DICE_WEIGHT +
    levenshtein * LEVENSHTEIN_WEIGHT +
    containmentScore * CONTAINMENT_WEIGHT
  ) * 100

  const boostedScore = Math.max(weightedScore, unorderedTokenScore * 100)
  return Math.round(boostedScore * 1000) / 1000
}

function compactNormalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/1\s*on\s*1/gi, "1on1")
    .replace(/[\s/,_\-.()[\]{}:：，、。!?！？'"]/g, "")
    .trim()
}

function bigrams(text: string): string[] {
  const chars = Array.from(text.replace(/\s+/g, ""))
  const grams: string[] = []
  for (let i = 0; i < chars.length - 1; i += 1) {
    grams.push(chars[i] + chars[i + 1])
  }
  return Array.from(new Set(grams))
}

function diceCoefficient(lhs: string, rhs: string): number {
  if (!lhs || !rhs) return 0
  if (lhs === rhs) return 1

  const lhsBigrams = bigrams(lhs)
  const rhsBigrams = bigrams(rhs)
  if (lhsBigrams.length === 0 || rhsBigrams.length === 0) {
    return lhs === rhs ? 1 : 0
  }

  const rhsCounts = new Map<string, number>()
  for (const gram of rhsBigrams) {
    rhsCounts.set(gram, (rhsCounts.get(gram) ?? 0) + 1)
  }

  let overlap = 0
  for (const gram of lhsBigrams) {
    const count = rhsCounts.get(gram) ?? 0
    if (count > 0) {
      overlap += 1
      rhsCounts.set(gram, count - 1)
    }
  }

  return (2 * overlap) / (lhsBigrams.length + rhsBigrams.length)
}

function normalizedLevenshteinSimilarity(lhs: string, rhs: string): number {
  if (!lhs || !rhs) return 0
  if (lhs === rhs) return 1

  const lhsChars = Array.from(lhs)
  const rhsChars = Array.from(rhs)
  const rows = lhsChars.length + 1
  const cols = rhsChars.length + 1
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = lhsChars[i - 1] === rhsChars[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  const distance = dp[rows - 1][cols - 1]
  const maxLength = Math.max(lhsChars.length, rhsChars.length)
  return maxLength === 0 ? 1 : 1 - distance / maxLength
}

function containmentSimilarity(query: string, target: string): number {
  if (!query || !target) return 0
  if (target.includes(query)) return 1
  if (query.includes(target)) return 0.9

  const subsequenceRatio = orderedSubsequenceRatio(query, target)
  const reverseSubsequenceRatio = orderedSubsequenceRatio(target, query)
  return Math.max(subsequenceRatio, reverseSubsequenceRatio * 0.9)
}

function orderedSubsequenceRatio(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0

  const needleChars = Array.from(needle)
  const haystackChars = Array.from(haystack)
  let matched = 0
  let haystackIndex = 0

  for (const char of needleChars) {
    while (haystackIndex < haystackChars.length && haystackChars[haystackIndex] !== char) {
      haystackIndex += 1
    }

    if (haystackIndex >= haystackChars.length) break

    matched += 1
    haystackIndex += 1
  }

  if (matched === 0) return 0
  return matched / Math.max(needleChars.length, haystackChars.length)
}

function unorderedTokenSimilarity(lhs: string, rhs: string): number {
  if (!lhs || !rhs) return 0
  if (lhs === rhs) return 1

  const lhsCounts = charCounts(lhs)
  const rhsCounts = charCounts(rhs)
  const keys = new Set([...lhsCounts.keys(), ...rhsCounts.keys()])

  let overlap = 0
  let total = 0

  for (const key of keys) {
    const lhsCount = lhsCounts.get(key) ?? 0
    const rhsCount = rhsCounts.get(key) ?? 0
    overlap += Math.min(lhsCount, rhsCount)
    total += Math.max(lhsCount, rhsCount)
  }

  return total === 0 ? 0 : overlap / total
}

function charCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const char of Array.from(text)) {
    counts.set(char, (counts.get(char) ?? 0) + 1)
  }
  return counts
}

function candidateKey(task: SearchableTask): string {
  if (task.subTaskId) return `sub_task:${task.subTaskId}`
  if (task.taskId) return `task:${task.taskId}`
  if (task.planItemId) return `daily_plan_item:${task.planItemId}`
  return `${task.sourceType}:${compactNormalizeText(task.content)}`
}

function sourcePriority(task: SearchableTask): number {
  switch (task.sourceType) {
    case "sub_task":
      return 0
    case "task":
      return 1
    case "daily_plan_item":
      return 2
    default:
      return 3
  }
}

function dedupeSearchableTasks(tasks: SearchableTask[]): SearchableTask[] {
  const seen = new Set<string>()
  const deduped: SearchableTask[] = []

  const prioritized = [...tasks].sort((lhs, rhs) => sourcePriority(lhs) - sourcePriority(rhs))

  for (const task of prioritized) {
    const key = candidateKey(task)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(task)
  }

  return deduped
}
