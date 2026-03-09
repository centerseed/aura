/**
 * QueryTasksSkill — 查詢今日任務
 *
 * 觸發詞：今天、要做什麼、有什麼事、待辦、任務清單、今日
 * 查詢 ACTIVE 任務（due_date <= 明天），依 due_date 排序
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { prisma } from "@/lib/db"

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

export const createQueryTasksSkill = (userId: string) =>
  skill({
    name: "query_tasks",
    description: "查詢今日任務清單",
    triggers: ["今天", "要做什麼", "有什麼事", "待辦", "任務清單", "今日", "有哪些任務"],
    priority: 7,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想查詢今日或近期需要處理的任務。請使用 query_today_tasks 工具查詢，" +
          "然後用繁體中文列出任務清單，有逾期的特別標注。",
        extraTools: [createQueryTodayTasksTool(userId)],
        skillName: "query_tasks",
      }),
  })
