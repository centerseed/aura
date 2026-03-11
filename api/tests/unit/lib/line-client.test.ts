import { describe, expect, it } from 'vitest'
import { formatMorningBriefingPush } from '@/lib/line-client'
import type { CoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'
import type { DailyPlanData } from '@/domain/interfaces/daily-plan-repository'

function makeBriefing(overrides: Partial<CoachBriefingData> = {}): CoachBriefingData {
  return {
    id: 'briefing-1',
    userId: 'user-1',
    type: 'MORNING',
    briefingDate: new Date('2026-03-11T00:00:00.000Z'),
    calendarEvents: [],
    overdueTasks: [],
    approachingTasks: [],
    conflicts: [],
    stagnations: [],
    completedTasks: [],
    remainingTasks: [],
    tomorrowPreview: [],
    summary: '今天先處理高優先度客戶回覆，再推進產品規劃。',
    recommendations: [
      { priority: 1, action: '先完成客戶回覆草稿', reasoning: '避免拖延', related_task_id: null },
    ],
    deferSuggestions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePlan(overrides: Partial<DailyPlanData> = {}): DailyPlanData {
  return {
    id: 'plan-1',
    userId: 'user-1',
    planDate: new Date('2026-03-11T00:00:00.000Z'),
    coachMessage: '聚焦',
    capacityNote: null,
    availableMinutes: 300,
    meetingMinutes: 30,
    plannedMinutes: 180,
    overflowItems: [],
    items: [
      {
        id: 'item-1',
        planId: 'plan-1',
        itemType: 'task',
        taskId: 'task-1',
        subTaskId: null,
        content: '完成客戶回覆',
        areaName: '營運',
        productName: 'Zentropy',
        estimatedMinutes: 45,
        dueDate: null,
        order: 1,
        reasoning: null,
        completed: false,
        completedAt: null,
        actualMinutes: null,
        pinned: false,
        deferred: false,
        status: 'today',
        userAdjusted: false,
        adjustedAt: null,
        taskName: null,
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'item-2',
        planId: 'plan-1',
        itemType: 'task',
        taskId: 'task-2',
        subTaskId: null,
        content: '整理下週規劃',
        areaName: '產品',
        productName: 'Zentropy',
        estimatedMinutes: 60,
        dueDate: null,
        order: 2,
        reasoning: null,
        completed: false,
        completedAt: null,
        actualMinutes: null,
        pinned: false,
        deferred: false,
        status: 'today',
        userAdjusted: false,
        adjustedAt: null,
        taskName: null,
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('formatMorningBriefingPush', () => {
  it('formats summary, recommendation, and today plan items', () => {
    const result = formatMorningBriefingPush(makeBriefing(), makePlan())

    expect(result).toContain('☀️ 早安！今天')
    expect(result).toContain('今天先處理高優先度客戶回覆')
    expect(result).toContain('💡 建議先做：先完成客戶回覆草稿')
    expect(result).toContain('1. 完成客戶回覆（45 分鐘）')
    expect(result).toContain('2. 整理下週規劃（60 分鐘）')
  })

  it('shows empty-plan fallback when there are no today items', () => {
    const result = formatMorningBriefingPush(makeBriefing(), makePlan({ items: [] }))

    expect(result).toContain('📋 今日任務')
    expect(result).toContain('今天沒有排定任務')
  })

  it('truncates very long content to stay within line limits', () => {
    const longSummary = 'A'.repeat(5200)
    const result = formatMorningBriefingPush(makeBriefing({ summary: longSummary }), makePlan())

    expect(result.length).toBeLessThanOrEqual(4901)
    expect(result.endsWith('…')).toBe(true)
  })
})
