/**
 * GeneratePlanUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeneratePlanUseCase } from '@/application/use-cases/coach/generate-plan'
import type { IDailyPlanRepository, DailyPlanData, CreateDailyPlanData } from '@/domain/interfaces/daily-plan-repository'
import type { CollectedData, PlanCandidate } from '@/application/services/plan-candidate-collector'
import type { UnifiedDataCollector, UnifiedRawData } from '@/infrastructure/services/unified-data-collector'
import type { UnifiedDataTransformer } from '@/infrastructure/services/unified-data-transformer'
import type { CoachPlanGenerator } from '@/application/services/coach-plan-generator'
import type { DailyPlanOutput } from '@/application/services/coach-plan-generator'
import type { CoachCalibration } from '@/application/services/coach-calibration'

// Mock prisma for resolveTimezone + writeBackEstimates + setStartDates + writeBackSuggestedDates
const { mockTaskUpdate, mockTaskFindMany } = vi.hoisted(() => ({
  mockTaskUpdate: vi.fn().mockResolvedValue({}),
  mockTaskFindMany: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
    subTask: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    task: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: mockTaskUpdate,
      findMany: mockTaskFindMany,
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}))

// ============================================================================
// Helpers
// ============================================================================

function makeCandidate(overrides: Partial<PlanCandidate> = {}): PlanCandidate {
  return {
    itemType: 'subtask',
    taskId: 'task-1',
    subTaskId: overrides.subTaskId ?? 'st-1',
    content: overrides.content ?? '測試任務',
    areaName: '產品',
    productName: 'Naruvia',
    productDescription: null,
    taskContent: '父任務',
    subTaskOrder: 1,
    estimatedMinutes: overrides.estimatedMinutes ?? null,
    dueDate: null,
    startDate: null,
    daysOverdue: null,
    daysRemaining: null,
    daysStagnant: 0,
    milestoneId: null,
    dateSource: null,
    ...overrides,
  }
}

function makePlanData(overrides: Partial<DailyPlanData> = {}): DailyPlanData {
  return {
    id: 'plan-1',
    userId: 'user-1',
    planDate: new Date('2026-02-14'),
    coachMessage: '加油！',
    capacityNote: '5 小時可用',
    availableMinutes: 300,
    meetingMinutes: 60,
    plannedMinutes: 120,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeDefaultCollectedData(overrides: Partial<CollectedData> = {}): CollectedData {
  return {
    candidates: [
      makeCandidate({ subTaskId: 'st-1', content: '任務 A', estimatedMinutes: 60 }),
      makeCandidate({ subTaskId: 'st-2', content: '任務 B', estimatedMinutes: 90 }),
      makeCandidate({ subTaskId: 'st-3', content: '任務 C', estimatedMinutes: 120 }),
    ],
    unscheduledTasks: [],
    milestones: [],
    productContexts: [],
    meetingMinutes: 60,
    availableMinutes: 180,
    weeklyOverview: [],
    ...overrides,
  }
}

function makeDefaultAiOutput(overrides: Partial<DailyPlanOutput> = {}): DailyPlanOutput {
  return {
    daily_plan: [
      { item_id: 'st-1', item_type: 'subtask', order: 1, estimated_minutes: 60, reasoning: '優先' },
      { item_id: 'st-2', item_type: 'subtask', order: 2, estimated_minutes: 90, reasoning: '其次' },
      { item_id: 'st-3', item_type: 'subtask', order: 3, estimated_minutes: 120, reasoning: '最後' },
    ],
    coach_message: '加油！',
    overflow_items: [],
    scheduling: [],
    ...overrides,
  }
}

// ============================================================================
// Mocks
// ============================================================================

let mockRepository: IDailyPlanRepository
let mockCollector: UnifiedDataCollector
let mockTransformer: UnifiedDataTransformer
let mockGenerator: CoachPlanGenerator
let mockCalibration: CoachCalibration
let useCase: GeneratePlanUseCase

beforeEach(() => {
  vi.clearAllMocks()

  mockRepository = {
    findByDate: vi.fn(),
    upsert: vi.fn<[CreateDailyPlanData], Promise<DailyPlanData>>().mockResolvedValue(makePlanData()),
    updateItem: vi.fn(),
  }

  const mockRawData: UnifiedRawData = {
    allTasks: [],
    allSubTasks: [],
    todayCalendar: [],
    tomorrowCalendar: [],
    weeklyCalendar: new Map(),
    completedTasks: [],
    unscheduledTasks: [],
    milestones: [],
  }

  mockCollector = {
    collect: vi.fn<[string, Date, string], Promise<UnifiedRawData>>().mockResolvedValue(mockRawData),
  } as any

  mockTransformer = {
    toPlanCollectedData: vi.fn().mockReturnValue(makeDefaultCollectedData()),
    toBriefingData: vi.fn().mockReturnValue({}),
  } as any

  mockGenerator = {
    generate: vi.fn().mockResolvedValue({
      output: makeDefaultAiOutput(),
      prompt: '你是 Zentropy 的營運教練...',
    }),
  } as any

  mockCalibration = {
    getCalibrationNote: vi.fn().mockResolvedValue(null),
  } as any

  useCase = new GeneratePlanUseCase(
    mockRepository,
    mockCollector,
    mockTransformer,
    mockGenerator,
    mockCalibration,
  )
})

// ============================================================================
// Tests
// ============================================================================

describe('GeneratePlanUseCase', () => {
  describe('容量硬截斷', () => {
    it('應截斷超過 availableMinutes 的項目', async () => {
      const result = await useCase.execute({ userId: 'user-1' })

      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      // A(60) + B(90) = 150 < 180 OK, +C(120) = 270 > 180 截斷
      const todayItems = upsertCall.items.filter((i: any) => i.status !== 'overflow')
      const overflowItems = upsertCall.items.filter((i: any) => i.status === 'overflow')
      expect(todayItems).toHaveLength(2)
      expect(todayItems[0].content).toBe('任務 A')
      expect(todayItems[1].content).toBe('任務 B')
      expect(overflowItems).toHaveLength(1)
      expect(overflowItems[0].content).toBe('任務 C')
      expect(upsertCall.plannedMinutes).toBe(150)
    })

    it('第一個項目即使超過容量也應排入', async () => {
      ;(mockTransformer.toPlanCollectedData as any).mockReturnValueOnce(makeDefaultCollectedData({
        candidates: [makeCandidate({ subTaskId: 'st-big', content: '大任務', estimatedMinutes: 300 })],
      }))
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          daily_plan: [{ item_id: 'st-big', item_type: 'subtask', order: 1, estimated_minutes: 300, reasoning: '唯一任務' }],
        }),
        prompt: 'test',
      })

      const result = await useCase.execute({ userId: 'user-1' })
      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      expect(upsertCall.items).toHaveLength(1)
      expect(upsertCall.items[0].content).toBe('大任務')
    })

    it('order 應從 1 重新編號', async () => {
      const result = await useCase.execute({ userId: 'user-1' })
      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      expect(upsertCall.items[0].order).toBe(1)
      expect(upsertCall.items[1].order).toBe(2)
    })
  })

  describe('校準失敗不阻塞', () => {
    it('calibration 拋錯時 AI 仍正常執行', async () => {
      ;(mockCalibration.getCalibrationNote as any).mockRejectedValue(new Error('DB error'))

      const result = await useCase.execute({ userId: 'user-1' })
      expect(mockGenerator.generate).toHaveBeenCalled()
      expect((mockGenerator.generate as any).mock.calls[0][3]).toBeUndefined()
    })
  })

  describe('prompt 回傳', () => {
    it('response 應包含 timings', async () => {
      const result = await useCase.execute({ userId: 'user-1' })
      expect(result.timings).toBeDefined()
      expect(result.timings.collect).toBeGreaterThanOrEqual(0)
      expect(result.timings.ai).toBeGreaterThanOrEqual(0)
      expect(result.timings.save).toBeGreaterThanOrEqual(0)
    })
  })

  describe('AI 估時優先', () => {
    it('AI 估時覆蓋候選值', async () => {
      ;(mockTransformer.toPlanCollectedData as any).mockReturnValueOnce(makeDefaultCollectedData({
        candidates: [makeCandidate({ subTaskId: 'st-1', estimatedMinutes: 60 })],
        availableMinutes: 480,
        meetingMinutes: 0,
      }))
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          daily_plan: [{ item_id: 'st-1', item_type: 'subtask', order: 1, estimated_minutes: 45, reasoning: 'ok' }],
        }),
        prompt: 'test',
      })

      await useCase.execute({ userId: 'user-1' })
      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      expect(upsertCall.items[0].estimatedMinutes).toBe(45)
    })

    it('AI 無估時時 fallback 到候選值', async () => {
      ;(mockTransformer.toPlanCollectedData as any).mockReturnValueOnce(makeDefaultCollectedData({
        candidates: [makeCandidate({ subTaskId: 'st-1', estimatedMinutes: 90 })],
        availableMinutes: 480,
        meetingMinutes: 0,
      }))
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          daily_plan: [{ item_id: 'st-1', item_type: 'subtask', order: 1, estimated_minutes: null, reasoning: 'ok' }],
        }),
        prompt: 'test',
      })

      await useCase.execute({ userId: 'user-1' })
      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      expect(upsertCall.items[0].estimatedMinutes).toBe(90)
    })

    it('兩者都無時 fallback 60 分鐘', async () => {
      ;(mockTransformer.toPlanCollectedData as any).mockReturnValueOnce(makeDefaultCollectedData({
        candidates: [makeCandidate({ subTaskId: 'st-1', estimatedMinutes: null })],
        availableMinutes: 480,
        meetingMinutes: 0,
      }))
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          daily_plan: [{ item_id: 'st-1', item_type: 'subtask', order: 1, estimated_minutes: null, reasoning: 'ok' }],
        }),
        prompt: 'test',
      })

      await useCase.execute({ userId: 'user-1' })
      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      expect(upsertCall.items[0].estimatedMinutes).toBe(60)
    })
  })

  describe('不認識的 item_id', () => {
    it('AI 回傳不存在的 item_id 時應忽略', async () => {
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          daily_plan: [
            { item_id: 'st-1', item_type: 'subtask', order: 1, estimated_minutes: 60, reasoning: 'ok' },
            { item_id: 'ghost-id', item_type: 'subtask', order: 2, estimated_minutes: 30, reasoning: '幻覺' },
          ],
        }),
        prompt: 'test',
      })

      await useCase.execute({ userId: 'user-1' })
      const upsertCall = (mockRepository.upsert as any).mock.calls[0][0] as CreateDailyPlanData
      expect(upsertCall.items.every(i => i.content !== undefined)).toBe(true)
    })
  })

  describe('日期排程回寫', () => {
    it('應將 AI 建議的日期回寫到任務', async () => {
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          scheduling: [
            {
              task_id: 'task-unscheduled-1',
              suggested_start_date: '2026-02-18',
              suggested_due_date: '2026-02-20',
              reasoning: '配合里程碑',
            },
          ],
        }),
        prompt: 'test',
      })

      // Mock findMany 回傳可更新的 task
      mockTaskFindMany.mockResolvedValueOnce([{ id: 'task-unscheduled-1' }])

      await useCase.execute({ userId: 'user-1' })

      // 驗證先查詢
      expect(mockTaskFindMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['task-unscheduled-1'] },
          OR: [{ date_source: null }, { date_source: 'coach' }],
        },
        select: { id: true },
      })

      // 驗證更新
      expect(mockTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-unscheduled-1' },
        data: {
          date_source: 'coach',
          start_date: new Date('2026-02-18'),
          due_date: new Date('2026-02-20'),
        },
      })
    })

    it('空 scheduling 不應報錯', async () => {
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({ scheduling: [] }),
        prompt: 'test',
      })

      await expect(useCase.execute({ userId: 'user-1' })).resolves.toBeDefined()
      // task.update 應只被 setStartDatesForPlannedItems 呼叫，不被 writeBackSuggestedDates 呼叫
    })

    it('AI 只建議 start_date 無 due_date 時應只寫 start_date', async () => {
      ;(mockGenerator.generate as any).mockResolvedValue({
        output: makeDefaultAiOutput({
          scheduling: [
            {
              task_id: 'task-x',
              suggested_start_date: '2026-02-18',
              suggested_due_date: null,
              reasoning: '已有 due_date',
            },
          ],
        }),
        prompt: 'test',
      })

      // Mock findMany 回傳可更新的 task
      mockTaskFindMany.mockResolvedValueOnce([{ id: 'task-x' }])

      await useCase.execute({ userId: 'user-1' })

      // 驗證先查詢可更新的 task
      expect(mockTaskFindMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['task-x'] },
          OR: [{ date_source: null }, { date_source: 'coach' }],
        },
        select: { id: true },
      })

      // 驗證更新時用簡單的 WHERE { id }
      expect(mockTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-x' },
        data: {
          date_source: 'coach',
          start_date: new Date('2026-02-18'),
        },
      })
    })
  })

  describe('傳遞 unscheduledTasks 和 milestones 給 generator', () => {
    it('應將 collector 的 unscheduledTasks 和 milestones 傳給 generator', async () => {
      const unscheduledTasks = [makeCandidate({ taskId: 'task-unsched', subTaskId: null, itemType: 'task' })]
      const milestones = [{
        id: 'ms-1',
        name: 'MVP 上線',
        targetDate: new Date('2026-03-01'),
        priority: 8,
        entityType: 'PRODUCT',
        entityName: 'Naruvia',
      }]

      ;(mockTransformer.toPlanCollectedData as any).mockReturnValueOnce(makeDefaultCollectedData({
        unscheduledTasks,
        milestones,
      }))

      await useCase.execute({ userId: 'user-1' })

      const generateCall = (mockGenerator.generate as any).mock.calls[0]
      // args: candidates[0], availableMinutes[1], meetingMinutes[2], calibrationNote[3], unscheduledTasks[4], milestones[5]
      expect(generateCall[4]).toEqual(unscheduledTasks)
      expect(generateCall[5]).toEqual(milestones)
    })
  })
})
