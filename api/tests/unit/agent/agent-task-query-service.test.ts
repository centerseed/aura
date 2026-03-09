import { describe, expect, it, vi } from "vitest"
import { AgentTaskQueryService } from "@/application/use-cases/agent/agent-task-query-service"
import type { IDataCollector, UnifiedRawData } from "@/domain/interfaces/data-collector"

function createRawData(overrides?: Partial<UnifiedRawData>): UnifiedRawData {
  return {
    allTasks: [],
    allSubTasks: [],
    todayCalendar: [],
    tomorrowCalendar: [],
    weeklyCalendar: new Map(),
    completedTasks: [],
    unscheduledTasks: [],
    milestones: [],
    ...overrides,
  }
}

describe("AgentTaskQueryService", () => {
  it("uses completed_at-backed collector data for completed-today summary", async () => {
    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(
        createRawData({
          completedTasks: [
            {
              id: "task-1",
              content: "完成 API 部署",
              completed_at: new Date("2026-03-09T10:00:00+08:00"),
              area_name: "工作",
              product_name: "Naruvia",
            },
          ],
        }),
      ),
    }

    const service = new AgentTaskQueryService(
      collector,
      vi.fn().mockResolvedValue("Asia/Taipei"),
      {
        getCompletedSubTasks: vi.fn().mockResolvedValue([]),
        getCompletedDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )
    const result = await service.queryCompletedToday("user-1")

    expect(result.totalCount).toBe(1)
    expect(result.summary).toContain("你今天已完成 1 項完成紀錄")
    expect(result.summary).toContain("完成 API 部署 [Naruvia]")
    expect(result.summary).toContain("查詢範圍：Task")
  })

  it("returns truthful empty-state with limited coverage note", async () => {
    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(createRawData()),
    }

    const service = new AgentTaskQueryService(
      collector,
      vi.fn().mockResolvedValue("Asia/Taipei"),
      {
        getCompletedSubTasks: vi.fn().mockResolvedValue([]),
        getCompletedDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )
    const result = await service.queryCompletedToday("user-1")

    expect(result.totalCount).toBe(0)
    expect(result.summary).toContain("還沒有完成任何項目")
    expect(result.summary).toContain("覆蓋 Task、SubTask、Daily Plan")
  })

  it("summarizes today-focus with total count and truncation", async () => {
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index + 1}`,
      content: `任務 ${index + 1}`,
      status: "ACTIVE",
      due_date: new Date("2026-03-09T09:00:00+08:00"),
      start_date: null,
      updated_at: new Date("2026-03-09T08:00:00+08:00"),
      completed_at: null,
      area_name: "工作",
      product_id: "product-1",
      product_name: "Naruvia",
      product_description: null,
      product_priority: null,
      inferred_from_milestone: null,
      date_source: null,
    }))

    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(createRawData({ allTasks: tasks })),
    }

    const service = new AgentTaskQueryService(
      collector,
      vi.fn().mockResolvedValue("Asia/Taipei"),
      {
        getCompletedSubTasks: vi.fn().mockResolvedValue([]),
        getCompletedDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )
    const result = await service.queryTodayFocus("user-1")

    expect(result.totalCount).toBe(12)
    expect(result.displayCount).toBe(10)
    expect(result.truncated).toBe(true)
    expect(result.summary).toContain("目前查到 12 項待處理 Task")
    expect(result.summary).toContain("以下列出最優先的 10 項")
  })

  it("includes subtask and daily plan completions without double counting archived task", async () => {
    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(
        createRawData({
          completedTasks: [
            {
              id: "task-1",
              content: "完成 API 部署",
              completed_at: new Date("2026-03-09T10:00:00+08:00"),
              area_name: "工作",
              product_name: "Naruvia",
            },
          ],
        }),
      ),
    }

    const service = new AgentTaskQueryService(
      collector,
      vi.fn().mockResolvedValue("Asia/Taipei"),
      {
        getCompletedSubTasks: vi.fn().mockResolvedValue([
          {
            id: "sub-1",
            title: "整理 release checklist",
            sourceType: "sub_task",
            productName: "Naruvia",
            completedAt: "2026-03-09T11:00:00+08:00",
          },
        ]),
        getCompletedDailyPlanItems: vi.fn().mockResolvedValue([
          {
            id: "plan-1",
            title: "下午例行回顧",
            sourceType: "daily_plan_item",
            productName: "Naruvia",
            completedAt: "2026-03-09T12:00:00+08:00",
          },
        ]),
      },
    )

    const result = await service.queryCompletedToday("user-1")

    expect(result.totalCount).toBe(3)
    expect(result.summary).toContain("你今天已完成 3 項完成紀錄")
    expect(result.summary).toContain("整理 release checklist [Naruvia] [SubTask]")
    expect(result.summary).toContain("下午例行回顧 [Naruvia] [Daily Plan]")
  })
})
