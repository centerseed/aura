/**
 * Scenario A.1: Claude Code 自動獲得任務脈絡
 *
 * 用戶打開 Claude Code，AI 讀取 zentropy://handoff/ready，
 * 看到結構化的意圖交接包（完整 context_package）。
 *
 * 驗證：
 * 1. handoff_items 包含今日 DailyPlan 的 high/medium priority 項目
 * 2. 每個 item 有 intent, priority, due, context_package
 * 3. context_package 包含 why, coach_notes, acceptance_criteria
 * 4. coach_notes 包含偏差校正資訊
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    dailyPlan: {
      findFirst: vi.fn(),
    },
    dailyPlanItem: {
      findMany: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

import { GetHandoffReadyUseCase } from '@/application/use-cases/mcp/get-handoff-ready'
import { prisma } from '@/lib/db'

const mockFindFirst = prisma.dailyPlan.findFirst as any
const mockFindMany = prisma.dailyPlanItem.findMany as any
const mockTaskFindUnique = prisma.task.findUnique as any
const mockQueryRaw = prisma.$queryRaw as any

describe('Scenario A.1: Claude Code 自動獲得任務脈絡', () => {
  let useCase: GetHandoffReadyUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new GetHandoffReadyUseCase()
  })

  it('應該返回結構化的 handoff_items', async () => {
    // Arrange: 模擬今日有計畫
    mockFindFirst.mockResolvedValue({
      id: 'plan-1',
      user_id: 'user-1',
      plan_date: new Date('2026-02-13'),
      coach_message: '今天專注 auth 重構',
      available_minutes: 360,
      meeting_minutes: 120,
      planned_minutes: 240,
    })

    mockFindMany.mockResolvedValue([
      {
        id: 'item-1',
        plan_id: 'plan-1',
        task_id: 'task-1',
        sub_task_id: null,
        content: '重構 auth 模組',
        area_name: 'Work',
        product_name: 'Zentropy',
        estimated_minutes: 240,
        order: 1,
        reasoning: '效能瓶頸，P95 延遲 > 2s',
        completed: false,
        pinned: false,
        deferred: false,
        task: {
          id: 'task-1',
          content: '重構 auth 模組，改用 async middleware',
          status: 'ACTIVE',
          due_date: new Date('2026-02-14'),
          urgency_level: 'high',
          product: {
            name: 'Zentropy',
            area: { name: 'Work' },
          },
          sub_tasks: [
            { id: 'st-1', content: '改 auth.ts middleware', estimated_minutes: 60 },
            { id: 'st-2', content: '更新 route handlers', estimated_minutes: 90 },
          ],
        },
      },
      {
        id: 'item-2',
        plan_id: 'plan-1',
        task_id: 'task-2',
        sub_task_id: null,
        content: 'Review PR #45',
        area_name: 'Work',
        product_name: 'Zentropy',
        estimated_minutes: 60,
        order: 2,
        reasoning: '阻擋 M2 開發',
        completed: false,
        pinned: false,
        deferred: false,
        task: {
          id: 'task-2',
          content: 'Review PR #45: Librarian 規則引擎重構',
          status: 'ACTIVE',
          due_date: new Date('2026-02-13'),
          urgency_level: 'medium',
          product: {
            name: 'Zentropy',
            area: { name: 'Work' },
          },
          sub_tasks: [],
        },
      },
    ])

    // Mock calibration data
    mockQueryRaw.mockResolvedValue([
      { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
      { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
      { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
    ])

    // Act
    const result = await useCase.execute({ userId: 'user-1' })

    // Assert: 結構化輸出
    expect(result.generated_at).toBeDefined()
    expect(result.handoff_items).toHaveLength(2)

    // 第一個 item: auth 重構
    const item1 = result.handoff_items[0]
    expect(item1.id).toBe('task-1')
    expect(item1.intent).toBe('重構 auth 模組，改用 async middleware')
    expect(item1.priority).toBeDefined()
    expect(item1.due).toBe('2026-02-14')
    expect(item1.status).toBe('active')

    // context_package 完整性
    expect(item1.context_package).toBeDefined()
    expect(item1.context_package.why).toBe('效能瓶頸，P95 延遲 > 2s')
    expect(item1.context_package.coach_notes).toBeDefined()
    expect(item1.context_package.coach_notes).toContain('1.80')

    // 第二個 item
    const item2 = result.handoff_items[1]
    expect(item2.id).toBe('task-2')
    expect(item2.intent).toContain('Review PR #45')
  })

  it('沒有計畫時應該返回空陣列', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result.handoff_items).toHaveLength(0)
    expect(result.generated_at).toBeDefined()
  })

  it('已完成和已延後的項目不應出現在 handoff_items', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'plan-1',
      user_id: 'user-1',
      plan_date: new Date('2026-02-13'),
      coach_message: '',
      available_minutes: 360,
      meeting_minutes: 0,
      planned_minutes: 120,
    })

    mockFindMany.mockResolvedValue([
      {
        id: 'item-1',
        plan_id: 'plan-1',
        task_id: 'task-1',
        sub_task_id: null,
        content: '已完成的任務',
        area_name: 'Work',
        product_name: 'Zentropy',
        estimated_minutes: 60,
        order: 1,
        reasoning: '',
        completed: true,  // 已完成
        pinned: false,
        deferred: false,
        task: null,
      },
      {
        id: 'item-2',
        plan_id: 'plan-1',
        task_id: 'task-2',
        sub_task_id: null,
        content: '已延後的任務',
        area_name: 'Work',
        product_name: 'Zentropy',
        estimated_minutes: 60,
        order: 2,
        reasoning: '',
        completed: false,
        pinned: false,
        deferred: true,  // 已延後
        task: null,
      },
    ])

    mockQueryRaw.mockResolvedValue([])

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result.handoff_items).toHaveLength(0)
  })
})
