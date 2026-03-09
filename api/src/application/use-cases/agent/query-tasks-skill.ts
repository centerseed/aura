/**
 * QueryTasksSkill — 查詢今日任務 / 今日完成
 *
 * 觸發詞：今天、要做什麼、有什麼事、待辦、任務清單、今日、完成了什麼
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { prisma } from "@/lib/db"

function getTodayRangeInTaipei() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(new Date())
  const year = parts.find((p) => p.type === "year")?.value
  const month = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Failed to calculate Taipei date range")
  }

  const start = new Date(`${year}-${month}-${day}T00:00:00+08:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)
  return { start, end }
}

const createQueryTodayTasksTool = (userId: string) =>
  tool({
    name: "query_today_tasks",
    description: "查詢今日與近期需要處理的 ACTIVE 任務清單",
    parameters: z.object({}),
    execute: async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(23, 59, 59, 999)

      // 有 due_date 且即將到期
      const dueSoonTasks = await prisma.task.findMany({
        where: {
          user_id: userId,
          status: "ACTIVE",
          deleted_at: null,
          due_date: { lte: tomorrow },
        },
        orderBy: { due_date: "asc" },
        take: 10,
        select: {
          id: true,
          content: true,
          due_date: true,
          product: { select: { name: true } },
        },
      })

      // 無 due_date 的 ACTIVE 任務（最多補足 10 筆）
      const noDateTasks = await prisma.task.findMany({
        where: {
          user_id: userId,
          status: "ACTIVE",
          deleted_at: null,
          due_date: null,
        },
        orderBy: { updated_at: "desc" },
        take: Math.max(0, 10 - dueSoonTasks.length),
        select: {
          id: true,
          content: true,
          due_date: true,
          product: { select: { name: true } },
        },
      })

      const all = [...dueSoonTasks, ...noDateTasks]
      if (all.length === 0) return "目前沒有進行中的任務。"

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const lines = all.map((t, i) => {
        const title = t.content.length > 40 ? t.content.slice(0, 40) + "…" : t.content
        const project = t.product?.name ? ` [${t.product.name}]` : ""
        let dateTag = ""
        if (t.due_date) {
          const dd = new Date(t.due_date)
          dd.setHours(0, 0, 0, 0)
          const diff = Math.round((dd.getTime() - today.getTime()) / 86400000)
          if (diff < 0) dateTag = " ⚠️ 逾期"
          else if (diff === 0) dateTag = " 📅 今天"
          else if (diff === 1) dateTag = " 📅 明天"
        }
        return `${i + 1}. ${title}${project}${dateTag}`
      })

      return `📋 今日任務（共 ${all.length} 筆）：\n${lines.join("\n")}`
    },
  })

const createQueryCompletedTodayTasksTool = (userId: string) =>
  tool({
    name: "query_completed_today_tasks",
    description: "查詢今日已完成（封存）的任務清單",
    parameters: z.object({}),
    execute: async () => {
      const { start, end } = getTodayRangeInTaipei()
      const completedToday = await prisma.task.findMany({
        where: {
          user_id: userId,
          status: "ARCHIVE",
          deleted_at: null,
          updated_at: { gte: start, lte: end },
        },
        orderBy: { updated_at: "desc" },
        take: 20,
        select: {
          id: true,
          content: true,
          updated_at: true,
          product: { select: { name: true } },
        },
      })

      if (completedToday.length === 0) return "你今天目前還沒有標記完成的任務。"

      const lines = completedToday.map((t, i) => {
        const title = t.content.length > 40 ? t.content.slice(0, 40) + "…" : t.content
        const project = t.product?.name ? ` [${t.product.name}]` : ""
        return `${i + 1}. ${title}${project}`
      })

      return `✅ 你今天已完成（共 ${completedToday.length} 筆）：\n${lines.join("\n")}`
    },
  })

export const createQueryTasksSkill = (userId: string) =>
  skill({
    name: "query_tasks",
    description: "查詢今日任務清單或今日完成清單",
    triggers: ["今天", "要做什麼", "有什麼事", "待辦", "任務清單", "今日", "有哪些任務", "完成了什麼", "今天完成"],
    priority: 10,
    run: async (message, _context) =>
      makeSkillResult({
        promptInjection: /今天.*完成|完成.*今天|完成了什麼|做了什麼/i.test(message)
          ? "用戶想查詢今天已完成的任務。請優先使用 query_completed_today_tasks 工具，" +
            "用繁體中文回覆，不要改成待辦清單。"
          : "用戶想查詢今日或近期需要處理的任務。請使用 query_today_tasks 工具查詢，" +
            "然後用繁體中文列出任務清單，有逾期的特別標注。",
        extraTools: [
          createQueryTodayTasksTool(userId),
          createQueryCompletedTodayTasksTool(userId),
        ],
        skillName: "query_tasks",
      }),
  })
