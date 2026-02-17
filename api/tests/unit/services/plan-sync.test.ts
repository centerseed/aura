/**
 * plan-sync service 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
    },
    subTask: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock repository
const mockFindByDate = vi.fn()
const mockAddItem = vi.fn()
const mockUpdateItem = vi.fn()
vi.mock('@/infrastructure/repositories/prisma-daily-plan-repository', () => ({
  PrismaDailyPlanRepository: vi.fn().mockImplementation(() => ({
    findByDate: mockFindByDate,
    addItem: mockAddItem,
    updateItem: mockUpdateItem,
  })),
}))

// Mock timezone utils
vi.mock('@/lib/timezone-utils', () => ({
  toDateOnly: (date: Date, _tz: string) => {
    const str = date.toISOString().split('T')[0]
    return new Date(str + 'T00:00:00.000Z')
  },
}))

import { syncPlanOnTaskChange } from '@/application/services/plan-sync'
import { prisma } from '@/lib/db'

const TODAY = new Date('2026-02-16T00:00:00.000Z')

function makePlan(items: any[] = []) {
  return {
    id: 'plan-1',
    userId: 'user-1',
    planDate: TODAY,
    coachMessage: null,
    capacityNote: null,
    availableMinutes: 480,
    meetingMinutes: 60,
    plannedMinutes: 300,
    overflowItems: [],
    items,
    createdAt: TODAY,
    updatedAt: TODAY,
  }
}

describe('syncPlanOnTaskChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('有 plan 且 due_date 在 3 天內 → 插入 item（status 根據日期決定）', async () => {
    const plan = makePlan([
      { taskId: 'other-task', subTaskId: null, order: 0 },
    ])
    mockFindByDate.mockResolvedValue(plan)
    mockAddItem.mockResolvedValue({})
    ;(prisma.task.findUnique as any).mockResolvedValue({
      content: '測試任務',
      estimated_minutes: 30,
      due_date: new Date('2026-02-17'),
      product: { name: '產品A', area: { name: '領域A' } },
    })

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-17', // 明天
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      taskId: 'task-1',
      subTaskId: null,
      content: '測試任務',
      areaName: '領域A',
      productName: '產品A',
      status: 'tomorrow', // ✅ 明天應該是 'tomorrow'
      order: 1,
    }))
  })

  it('已存在相同 task 且 status 相同 → 不重複插入也不更新', async () => {
    const plan = makePlan([
      { id: 'item-1', taskId: 'task-1', subTaskId: null, order: 0, status: 'tomorrow', userAdjusted: false },
    ])
    mockFindByDate.mockResolvedValue(plan)

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-17', // 明天 → status 應為 tomorrow
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('已存在相同 task 但 status 變了 → 更新 status', async () => {
    const plan = makePlan([
      { id: 'item-1', taskId: 'task-1', subTaskId: null, order: 0, status: 'tomorrow', userAdjusted: false },
    ])
    mockFindByDate.mockResolvedValue(plan)
    mockUpdateItem.mockResolvedValue({})

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-16', // 今天 → status 應為 today
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { status: 'today' })
  })

  it('已存在且 userAdjusted → 不更新 status', async () => {
    const plan = makePlan([
      { id: 'item-1', taskId: 'task-1', subTaskId: null, order: 0, status: 'today', userAdjusted: true },
    ])
    mockFindByDate.mockResolvedValue(plan)

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-17', // 明天，但用戶手動調整過
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('due_date 超過 3 天 → 不插入', async () => {
    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-25',
      timezone: 'Asia/Taipei',
    })

    expect(mockFindByDate).not.toHaveBeenCalled()
    expect(mockAddItem).not.toHaveBeenCalled()
  })

  it('沒有 plan → 不插入', async () => {
    mockFindByDate.mockResolvedValue(null)

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-17',
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).not.toHaveBeenCalled()
  })

  it('dueDate 為 null → 直接 return', async () => {
    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: null,
    })

    expect(mockFindByDate).not.toHaveBeenCalled()
  })

  it('dueDate 過去日期 → 不插入', async () => {
    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-10',
      timezone: 'Asia/Taipei',
    })

    expect(mockFindByDate).not.toHaveBeenCalled()
  })

  it('subtask → 使用 subtask content 和 due_date', async () => {
    const plan = makePlan([
      { taskId: 'other', subTaskId: null, order: 0 },
    ])
    mockFindByDate.mockResolvedValue(plan)
    mockAddItem.mockResolvedValue({})
    ;(prisma.task.findUnique as any).mockResolvedValue({
      content: '父任務',
      estimated_minutes: 60,
      due_date: new Date('2026-02-17'),
      product: { name: '產品B', area: { name: '領域B' } },
    })
    ;(prisma.subTask.findUnique as any).mockResolvedValue({
      content: '子任務內容',
      due_date: new Date('2026-02-16'), // 今天
    })

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      subTaskId: 'sub-1',
      dueDate: '2026-02-17', // 參數是明天，但會被 subtask 的今天覆蓋
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      taskId: 'task-1',
      subTaskId: 'sub-1',
      content: '子任務內容',
      status: 'today', // ✅ subtask 的 due_date 是今天，應該是 'today'
    }))
  })

  it('空 plan (無 items) → order 為 0', async () => {
    const plan = makePlan([])
    mockFindByDate.mockResolvedValue(plan)
    mockAddItem.mockResolvedValue({})
    ;(prisma.task.findUnique as any).mockResolvedValue({
      content: '任務',
      estimated_minutes: null,
      due_date: new Date('2026-02-16'),
      product: null,
    })

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-1',
      dueDate: '2026-02-16',
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      order: 0,
      areaName: 'Unknown',
      productName: 'Unknown',
    }))
  })

  it('due_date 為今天 → status 為 today', async () => {
    const plan = makePlan([])
    mockFindByDate.mockResolvedValue(plan)
    mockAddItem.mockResolvedValue({})
    ;(prisma.task.findUnique as any).mockResolvedValue({
      content: '今日任務',
      estimated_minutes: 60,
      due_date: new Date('2026-02-16'),
      product: { name: '產品C', area: { name: '領域C' } },
    })

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-today',
      dueDate: '2026-02-16', // 今天
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      taskId: 'task-today',
      status: 'today',
    }))
  })

  it('due_date 為後天 → status 為 overflow', async () => {
    const plan = makePlan([])
    mockFindByDate.mockResolvedValue(plan)
    mockAddItem.mockResolvedValue({})
    ;(prisma.task.findUnique as any).mockResolvedValue({
      content: '後天任務',
      estimated_minutes: 30,
      due_date: new Date('2026-02-18'),
      product: { name: '產品D', area: { name: '領域D' } },
    })

    await syncPlanOnTaskChange({
      userId: 'user-1',
      taskId: 'task-overflow',
      dueDate: '2026-02-18', // 後天
      timezone: 'Asia/Taipei',
    })

    expect(mockAddItem).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      taskId: 'task-overflow',
      status: 'overflow',
    }))
  })
})
