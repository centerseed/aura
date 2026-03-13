import { makeSkillResult, skill, tool } from "naru-agent-js"
import { z } from "zod"
import {
  AgentCalendarQueryService,
  serializeCalendarQueryToolResult,
} from "./agent-calendar-query-service"

export const createQueryCalendarTool = (userId: string, message: string) =>
  tool({
    name: "query_calendar",
    description: "查詢今天或明天的會議、行程或空檔。",
    parameters: z.object({}),
    execute: async () => {
      const service = new AgentCalendarQueryService()
      const result = await service.query(userId, message)
      return serializeCalendarQueryToolResult(result)
    },
  })

export const createQueryCalendarSkill = (userId: string) =>
  skill({
    name: "query_calendar",
    description: "查詢今天或明天的會議、行程或可用空檔",
    triggers: [],
    priority: 11,
    run: async (message, _context) =>
      makeSkillResult({
        promptInjection:
          "用戶想查詢日曆資訊。請使用 query_calendar 工具，並先讀取工具回傳的 [FACTS] JSON。" +
          "如果 FACTS 的 queryType 是 events，就回答會議/行程；如果是 availability，就回答空檔。" +
          "回覆時只能根據工具結果，不得自行補會議或空檔。",
        extraTools: [createQueryCalendarTool(userId, message)],
        skillName: "query_calendar",
      }),
  })
