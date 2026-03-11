import { beforeEach, describe, expect, it, vi } from "vitest"
import { createQueryTasksSkill } from "@/application/use-cases/agent/query-tasks-skill"

const mockQueryCompletedToday = vi.fn()
const mockQueryTodayFocus = vi.fn()

vi.mock("@/application/use-cases/agent/agent-task-query-service", () => ({
  AgentTaskQueryService: vi.fn().mockImplementation(() => ({
    queryCompletedToday: mockQueryCompletedToday,
    queryTodayFocus: mockQueryTodayFocus,
  })),
  serializeQueryToolResult: vi.fn((result) =>
    `[FACTS]\n${JSON.stringify({ totalCount: result.totalCount, groupedSummary: result.groupedSummary }, null, 2)}\n[/FACTS]\n\n${result.summary}`),
}))

describe("QueryTasksSkill scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("instructs the model to choose completed-today vs today-focus from the original message", async () => {
    const skill = createQueryTasksSkill("user-1")
    const result = await skill.run("我今天完成了什麼？", {})

    expect(result.promptInjection).toContain("query_completed_today_tasks")
    expect(result.promptInjection).toContain("query_today_tasks")
    expect(result.extraTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["query_today_tasks", "query_completed_today_tasks"]),
    )
  })

  it("uses one shared query prompt instead of regex-splitting prompt variants", async () => {
    const skill = createQueryTasksSkill("user-1")
    const result = await skill.run("我今天要做什麼？", {})

    expect(result.promptInjection).toContain("用戶原句自行判斷")
    expect(result.promptInjection).toContain("不得把已完成清單說成待辦")
  })

  it("query_completed_today_tasks delegates to query service", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天完成了什麼", {})
    const completedTool = runResult.extraTools.find((t) => t.name === "query_completed_today_tasks")

    mockQueryCompletedToday.mockResolvedValueOnce({
      queryType: "completed_today",
      timezone: "Asia/Taipei",
      coverage: { tasks: true, subTasks: true, dailyPlanItems: true },
      totalCount: 2,
      displayCount: 2,
      truncated: false,
      items: [],
      groupedSummary: [{ label: "Task", count: 2 }],
      summary: "✅ 今天你已完成 2 項：\n\n1. 完成 API 部署｜Naruvia",
    })

    const output = await completedTool!.execute({})
    expect(mockQueryCompletedToday).toHaveBeenCalledWith("user-1")
    expect(output).toContain("[FACTS]")
    expect(output).toContain("\"totalCount\": 2")
    expect(output).toContain("今天你已完成 2 項")
  })

  it("query_today_tasks delegates to query service", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天有哪些任務", {})
    const todayTool = runResult.extraTools.find((t) => t.name === "query_today_tasks")

    mockQueryTodayFocus.mockResolvedValueOnce({
      queryType: "today_focus",
      scopeLabel: "今天",
      timezone: "Asia/Taipei",
      coverage: { tasks: true, subTasks: true, dailyPlanItems: true },
      totalCount: 3,
      displayCount: 3,
      truncated: false,
      items: [],
      groupedSummary: [{ label: "今天", count: 3 }],
      summary: "📋 你今天手上還有 3 項：\n\n1. 提交版本更新｜Naruvia 📅 今天",
    })

    const output = await todayTool!.execute({})
    expect(mockQueryTodayFocus).toHaveBeenCalledWith("user-1", undefined, {
      strictToday: undefined,
      dayOffset: undefined,
    })
    expect(output).toContain("[FACTS]")
    expect(output).toContain("\"groupedSummary\"")
    expect(output).toContain("提交版本更新")
  })
})
