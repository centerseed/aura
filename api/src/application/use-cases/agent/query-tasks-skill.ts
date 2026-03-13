/**
 * QueryTasksSkill — 查詢今日任務 / 今日完成
 */

import { tool, skill, makeSkillResult } from "naru-agent-js"
import { z } from "zod"
import { AgentTaskQueryService, serializeQueryToolResult } from "./agent-task-query-service"

export interface QueryTodayTasksToolOptions {
  strictToday?: boolean
  dayOffset?: number
}

export const createQueryTodayTasksTool = (
  userId: string,
  options?: QueryTodayTasksToolOptions,
) =>
  tool({
    name: "query_today_tasks",
    description: "查詢指定日期範圍內需要處理的任務。預設查今天與近期；若提供 dayOffset，則查該日的待辦。",
    parameters: z.object({}),
    execute: async () => {
      const queryService = new AgentTaskQueryService()
      const result = await queryService.queryTodayFocus(userId, undefined, {
        strictToday: options?.strictToday,
        dayOffset: options?.dayOffset,
      })
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
    triggers: [],
    priority: 10,
    run: async (_message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想查詢任務狀態。請根據用戶原句自行判斷要呼叫哪個工具：" +
          "如果是在問今天已完成什麼，就用 query_completed_today_tasks；" +
          "如果是在問今日或近期待辦，就用 query_today_tasks。" +
          "先讀取工具回傳的 [FACTS] JSON 區塊，再根據後面的摘要回答。" +
          "回覆時只能根據工具結果，不得把已完成清單說成待辦，也不得把待辦清單說成已完成。" +
          "如果 FACTS 顯示查詢範圍限制、總數、群組摘要或只列出部分項目，你必須照實說明。",
        extraTools: [
          createQueryTodayTasksTool(userId),
          createQueryCompletedTodayTasksTool(userId),
        ],
        skillName: "query_tasks",
      }),
  })
