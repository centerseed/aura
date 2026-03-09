import { beforeEach, describe, expect, it, vi } from "vitest"
import { createQueryTasksSkill } from "@/application/use-cases/agent/query-tasks-skill"

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/db"

describe("QueryTasksSkill scenarios", () => {
  const mockFindMany = prisma.task.findMany as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes '今天完成了什麼' to completed-today prompt", async () => {
    const skill = createQueryTasksSkill("user-1")
    const result = await skill.run("我今天完成了什麼？", {})

    expect(result.promptInjection).toContain("今天已完成")
    expect(result.extraTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["query_today_tasks", "query_completed_today_tasks"])
    )
  })

  it("routes '今天要做什麼' to today-active prompt", async () => {
    const skill = createQueryTasksSkill("user-1")
    const result = await skill.run("我今天要做什麼？", {})

    expect(result.promptInjection).toContain("今日或近期需要處理")
    expect(result.promptInjection).not.toContain("今天已完成")
  })

  it("query_completed_today_tasks returns completed list", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天完成了什麼", {})
    const completedTool = runResult.extraTools.find((t) => t.name === "query_completed_today_tasks")

    expect(completedTool).toBeTruthy()
    mockFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        content: "完成 API 部署",
        updated_at: new Date("2026-03-09T10:00:00+08:00"),
        product: { name: "Naruvia" },
      },
      {
        id: "t2",
        content: "修正 LINE Agent 查詢邏輯",
        updated_at: new Date("2026-03-09T11:30:00+08:00"),
        product: { name: "Zentropy" },
      },
    ])

    const output = await completedTool!.execute({})
    expect(output).toContain("你今天已完成")
    expect(output).toContain("完成 API 部署 [Naruvia]")
    expect(output).toContain("修正 LINE Agent 查詢邏輯 [Zentropy]")
  })

  it("query_completed_today_tasks returns empty-state message", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天做了什麼", {})
    const completedTool = runResult.extraTools.find((t) => t.name === "query_completed_today_tasks")

    mockFindMany.mockResolvedValueOnce([])
    const output = await completedTool!.execute({})

    expect(output).toContain("今天目前還沒有標記完成")
  })

  it("query_today_tasks returns active task list", async () => {
    const skill = createQueryTasksSkill("user-1")
    const runResult = await skill.run("今天有哪些任務", {})
    const todayTool = runResult.extraTools.find((t) => t.name === "query_today_tasks")

    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "a1",
          content: "提交版本更新",
          due_date: new Date(),
          product: { name: "Naruvia" },
        },
      ])
      .mockResolvedValueOnce([])

    const output = await todayTool!.execute({})
    expect(output).toContain("今日任務")
    expect(output).toContain("提交版本更新")
  })
})
