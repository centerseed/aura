import { beforeEach, describe, expect, it, vi } from "vitest"
import { createQueryCalendarSkill } from "@/application/use-cases/agent/query-calendar-skill"

const mockCalendarQuery = vi.fn()

vi.mock("@/application/use-cases/agent/agent-calendar-query-service", () => ({
  AgentCalendarQueryService: vi.fn().mockImplementation(() => ({
    query: mockCalendarQuery,
  })),
  serializeCalendarQueryToolResult: vi.fn((result) =>
    `[FACTS]\n${JSON.stringify({ queryType: result.queryType, totalCount: result.totalCount }, null, 2)}\n[/FACTS]\n\n${result.summary}`),
}))

describe("QueryCalendarSkill scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not rely on keyword triggers", () => {
    const skill = createQueryCalendarSkill("user-1") as unknown as { triggers?: string[] }

    expect(skill.triggers ?? []).toEqual([])
  })

  it("injects one shared calendar query tool for event/availability questions", async () => {
    const skill = createQueryCalendarSkill("user-1")
    const result = await skill.run("我明天有什麼會議？", {})

    expect(result.promptInjection).toContain("query_calendar")
    expect(result.extraTools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["query_calendar"]),
    )
  })

  it("query_calendar delegates to calendar query service with the original message", async () => {
    const skill = createQueryCalendarSkill("user-1")
    const runResult = await skill.run("明天下午有空嗎？", {})
    const calendarTool = runResult.extraTools.find((tool) => tool.name === "query_calendar")

    mockCalendarQuery.mockResolvedValueOnce({
      queryType: "availability",
      scopeLabel: "明天下午",
      timezone: "Asia/Tokyo",
      totalCount: 2,
      truncated: false,
      availableSlots: [
        { start: "2026-03-12T04:00:00.000Z", end: "2026-03-12T05:00:00.000Z", durationMinutes: 60 },
      ],
      presentedEntities: [],
      summary: "⏳ 明天下午共有 2 段可用空檔：\n\n1. 13:00-14:00（60 分鐘）",
    })

    const output = await calendarTool!.execute({})

    expect(mockCalendarQuery).toHaveBeenCalledWith("user-1", "明天下午有空嗎？")
    expect(output).toContain("[FACTS]")
    expect(output).toContain("\"queryType\": \"availability\"")
    expect(output).toContain("可用空檔")
  })
})
