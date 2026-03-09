/**
 * QueryTasksSkill — 查詢今日任務 / 今日完成
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { AgentTaskQueryService } from "./agent-task-query-service"

const createQueryTodayTasksTool = (userId: string) =>
  tool({
    name: "query_today_tasks",
    description: "查詢今日與近期需要處理的任務摘要",
    parameters: z.object({}),
    execute: async () => {
      const queryService = new AgentTaskQueryService()
      const result = await queryService.queryTodayFocus(userId)
      return result.summary
    },
  })

const createQueryCompletedTodayTasksTool = (userId: string) =>
  tool({
    name: "query_completed_today_tasks",
    description: "查詢今日已完成的任務摘要",
    parameters: z.object({}),
    execute: async () => {
      const queryService = new AgentTaskQueryService()
      const result = await queryService.queryCompletedToday(userId)
      return result.summary
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
            "回覆時只能根據工具結果，不要改成待辦清單；如果工具明確標示查詢範圍或只列出部分項目，你必須照實說明。"
          : "用戶想查詢今日或近期需要處理的任務。請使用 query_today_tasks 工具查詢，" +
            "回覆時只能根據工具結果；如果工具明確標示查詢範圍或只列出部分項目，你必須照實說明。",
        extraTools: [
          createQueryTodayTasksTool(userId),
          createQueryCompletedTodayTasksTool(userId),
        ],
        skillName: "query_tasks",
      }),
  })

