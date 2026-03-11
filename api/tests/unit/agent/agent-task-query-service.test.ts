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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )
    const result = await service.queryCompletedToday("user-1")

    expect(result.scopeLabel).toBe("今天")
    expect(result.totalCount).toBe(1)
    expect(result.groupedSummary).toEqual([{ label: "Task", count: 1 }])
    expect(result.summary).toContain("今天你已完成 1 項")
    expect(result.summary).toContain("先看重點：Task 1 項")
    expect(result.summary).toContain("完成 API 部署｜Naruvia")
    expect(result.summary).toContain("補充：這次查詢涵蓋 Task")
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )
    const result = await service.queryCompletedToday("user-1")

    expect(result.totalCount).toBe(0)
    expect(result.summary).toContain("今天還沒有查到完成項目")
    expect(result.summary).toContain("補充：這次查詢涵蓋 Task、SubTask、Daily Plan")
  })

  it("summarizes today-focus with total count and truncation", async () => {
    const today = new Date()
    today.setHours(9, 0, 0, 0)
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index + 1}`,
      content: `任務 ${index + 1}`,
      status: "ACTIVE",
      due_date: today,
      start_date: null,
      updated_at: today,
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )
    const result = await service.queryTodayFocus("user-1")

    expect(result.scopeLabel).toBe("今天")
    expect(result.totalCount).toBe(12)
    expect(result.displayCount).toBe(10)
    expect(result.truncated).toBe(true)
    expect(result.summary).toContain("你今天手上還有 12 項")
    expect(result.summary).toContain("我先列最需要注意的 10 項")
    expect(result.summary).toContain("先看重點：今天 12 項")
  })

  it("prioritizes daily plan and subtask items in today-focus", async () => {
    const today = new Date()
    today.setHours(9, 0, 0, 0)

    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(
        createRawData({
          allTasks: [
            {
              id: "task-1",
              content: "提交版本更新",
              status: "ACTIVE",
              due_date: today,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([
          {
            id: "plan-1",
            title: "上午重點工作",
            sourceType: "daily_plan_item",
            productName: "Naruvia",
            dueDate: today.toISOString(),
            urgency: "today",
            relatedTaskId: "task-1",
          },
        ]),
      },
    )

    const result = await service.queryTodayFocus("user-1")

    expect(result.scopeLabel).toBe("今天")
    expect(result.coverage).toEqual({
      tasks: true,
      subTasks: true,
      dailyPlanItems: true,
    })
    expect(result.items[0].sourceType).toBe("daily_plan_item")
    expect(result.summary).toContain("先看重點：今天 1 項")
    expect(result.summary).toContain("上午重點工作｜Naruvia・日計畫")
  })

  it("uses strict-today filtering for unfinished-today queries", async () => {
    const today = new Date()
    today.setHours(9, 0, 0, 0)
    const overdue = new Date(today)
    overdue.setDate(overdue.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(
        createRawData({
          allTasks: [
            {
              id: "task-overdue",
              content: "補交對帳",
              status: "ACTIVE",
              due_date: overdue,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
            },
            {
              id: "task-tomorrow",
              content: "整理明天簡報",
              status: "ACTIVE",
              due_date: tomorrow,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
            },
            {
              id: "task-unscheduled",
              content: "想一下新功能",
              status: "ACTIVE",
              due_date: null,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
            },
          ],
          unscheduledTasks: [
            {
              id: "task-unscheduled",
              content: "想一下新功能",
              status: "ACTIVE",
              due_date: null,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([
          {
            id: "plan-1",
            title: "今天先處理客服回報",
            sourceType: "daily_plan_item",
            productName: "Naruvia",
            dueDate: today.toISOString(),
            urgency: "today",
            relatedTaskId: "plan-task-1",
          },
        ]),
      },
    )

    const result = await service.queryTodayFocus("user-1", undefined, { strictToday: true })

    expect(result.totalCount).toBe(2)
    expect(result.groupedSummary).toEqual([
      { label: "逾期", count: 1 },
      { label: "今天", count: 1 },
    ])
    expect(result.summary).toContain("今天先處理客服回報｜Naruvia・日計畫 📅 今天")
    expect(result.summary).toContain("補交對帳｜Naruvia ⚠️ 逾期")
    expect(result.summary).not.toContain("整理明天簡報")
    expect(result.summary).not.toContain("想一下新功能")
  })

  it("uses tomorrow-only filtering when dayOffset is 1", async () => {
    const today = new Date()
    today.setHours(9, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(
        createRawData({
          allTasks: [
            {
              id: "task-today",
              content: "今天的收尾",
              status: "ACTIVE",
              due_date: today,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
            },
            {
              id: "task-tomorrow",
              content: "明天的簡報",
              status: "ACTIVE",
              due_date: tomorrow,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
            },
            {
              id: "task-later",
              content: "後天的整理",
              status: "ACTIVE",
              due_date: dayAfterTomorrow,
              start_date: null,
              updated_at: today,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([
          {
            id: "plan-tomorrow",
            title: "明天先處理客戶回覆",
            sourceType: "daily_plan_item",
            productName: "Naruvia",
            dueDate: tomorrow.toISOString(),
            urgency: "today",
            relatedTaskId: "task-tomorrow",
          },
        ]),
      },
    )

    const result = await service.queryTodayFocus("user-1", undefined, { dayOffset: 1 })

    expect(result.scopeLabel).toBe("明天")
    expect(result.totalCount).toBe(1)
    expect(result.groupedSummary).toEqual([{ label: "明天", count: 1 }])
    expect(result.summary).toContain("你明天手上還有 1 項")
    expect(result.summary).toContain("明天先處理客戶回覆｜Naruvia・日計畫 📅 明天")
    expect(result.summary).not.toContain("今天的收尾")
    expect(result.summary).not.toContain("後天的整理")
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )

    const result = await service.queryCompletedToday("user-1")

    expect(result.totalCount).toBe(3)
    expect(result.groupedSummary).toEqual(
      expect.arrayContaining([
        { label: "Task", count: 1 },
        { label: "SubTask", count: 1 },
        { label: "Daily Plan", count: 1 },
      ]),
    )
    expect(result.summary).toContain("今天你已完成 3 項")
    expect(result.summary).toContain("先看重點：Task 1 項、SubTask 1 項、Daily Plan 1 項")
    expect(result.summary).toContain("整理 release checklist｜Naruvia・子項")
    expect(result.summary).toContain("下午例行回顧｜Naruvia・日計畫")
  })

  it("promotes open subtasks into today-focus work items before parent tasks", async () => {
    const todayDate = new Date()
    todayDate.setHours(9, 0, 0, 0)
    const tomorrowDate = new Date(todayDate)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const collector: IDataCollector = {
      collect: vi.fn().mockResolvedValue(
        createRawData({
          allTasks: [
            {
              id: "task-1",
              content: "發布 API 版本",
              status: "ACTIVE",
              due_date: tomorrowDate,
              start_date: null,
              updated_at: todayDate,
              completed_at: null,
              area_name: "工作",
              product_id: "product-1",
              product_name: "Naruvia",
              product_description: null,
              product_priority: null,
              inferred_from_milestone: null,
              date_source: null,
            },
          ],
          allSubTasks: [
            {
              id: "sub-1",
              task_id: "task-1",
              content: "確認 migration",
              completed: false,
              due_date: todayDate,
              start_date: null,
              estimated_minutes: null,
              order: 1,
              updated_at: todayDate,
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
      {
        getTodayFocusDailyPlanItems: vi.fn().mockResolvedValue([]),
      },
    )

    const result = await service.queryTodayFocus("user-1")

    expect(result.totalCount).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: "sub-1",
      sourceType: "sub_task",
      relatedTaskId: "task-1",
    })
    expect(result.summary).toContain("確認 migration｜Naruvia・子項 📅 今天")
  })
})
