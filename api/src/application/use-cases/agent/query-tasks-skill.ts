/**
 * QueryTasksSkill — 查詢今日任務 / 今日完成
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { AgentTaskQueryService, serializeQueryToolResult } from "./agent-task-query-service"

export const createQueryTodayTasksTool = (userId: string) =>
  tool({
    name: "query_today_tasks",
    description: "查詢今天與近期需要處理的任務。當用戶詢問今天要做什麼、待辦、有哪些任務時必須使用。",
    parameters: z.object({}),
    execute: async () => {
      const queryService = new AgentTaskQueryService()
      const result = await queryService.queryTodayFocus(userId)
      return serializeQueryToolResult(result)
    },
  })

export const createQueryCompletedTodayTasksTool = (userId: string) =>
  tool({
    name: "query_completed_today_tasks",
    description: "查詢今天已完成的任務。當用戶詢問今天完成了什麼、今天做了什麼時必須使用。",
    parameters: z.object({}),
    execute: async () => {
      const queryService = new AgentTaskQueryService()
      const result = await queryService.queryCompletedToday(userId)
      return serializeQueryToolResult(result)
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
            "先讀取工具回傳的 [FACTS] JSON 區塊，再根據後面的摘要回答。" +
            "回覆時只能根據工具結果，不要改成待辦清單；如果 FACTS 顯示查詢範圍限制、總數、群組摘要或只列出部分項目，你必須照實說明。"
          : "用戶想查詢今日或近期需要處理的任務。請使用 query_today_tasks 工具查詢，" +
            "先讀取工具回傳的 [FACTS] JSON 區塊，再根據後面的摘要回答。" +
            "回覆時只能根據工具結果；如果 FACTS 顯示查詢範圍限制、總數、群組摘要或只列出部分項目，你必須照實說明。",
        extraTools: [
          createQueryTodayTasksTool(userId),
          createQueryCompletedTodayTasksTool(userId),
        ],
        skillName: "query_tasks",
      }),
  })
