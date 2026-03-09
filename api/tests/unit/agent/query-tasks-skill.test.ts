import { beforeEach, describe, expect, it, vi } from "vitest"
import { createQueryTasksSkill } from "@/application/use-cases/agent/query-tasks-skill"

const mockQueryCompletedToday = vi.fn()
const mockQueryTodayFocus = vi.fn()

vi.mock("@/application/use-cases/agent/agent-task-query-service", () => ({
  AgentTaskQueryService: vi.fn().mockImplementation(() => ({
    queryCompletedToday: mockQueryCompletedToday,
    queryTodayFocus: mockQueryTodayFocus,
  })),
}))

describe("QueryTasksSkill scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes '今天完成了什麼' to completed-today prompt", async () => {
    const skill = createQueryTasksSkill("user-1")
    const result = await skill.run("我今天完成了什麼？", {})

    expect(result.promptInjection).toContain("今天已完成")
    expect(result.extraTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["query_today_tasks", "query_completed_today_tasks"]),
    )
  })

  it("routes '今天要做什麼' to today-active prompt", async () => {
    const skill = createQueryTasksSkill("user-1")
    const result = await skill.run("我今天要做什麼？", {})

    expect(result.promptInjection).toContain("今日或近期需要處理")
    expect(result.promptInjection).not.toContain("今天已完成")
  })

  it("query_completed_today_tasks delegates to query service", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天完成了什麼", {})
    const completedTool = runResult.extraTools.find((t) => t.name === "query_completed_today_tasks")

    mockQueryCompletedToday.mockResolvedValueOnce({
      summary: "✅ 目前查到你今天已完成 2 項 Task：\n\n1. 完成 API 部署 [Naruvia]",
    })

    const output = await completedTool!.execute({})
    expect(mockQueryCompletedToday).toHaveBeenCalledWith("user-1")
    expect(output).toContain("你今天已完成 2 項 Task")
  })

  it("query_today_tasks delegates to query service", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天有哪些任務", {})
    const todayTool = runResult.extraTools.find((t) => t.name === "query_today_tasks")

    mockQueryTodayFocus.mockResolvedValueOnce({
      summary: "📋 目前查到 3 項待處理 Task：\n\n1. 提交版本更新 [Naruvia] 📅 今天",
    })

    const output = await todayTool!.execute({})
    expect(mockQueryTodayFocus).toHaveBeenCalledWith("user-1")
    expect(output).toContain("提交版本更新")
  })
})

