/**
 * GenerateBriefingUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateBriefingUseCase } from '@/application/use-cases/coach/generate-briefing'
import type { ICoachBriefingRepository, CoachBriefingData, CreateCoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'
import type { AggregatedData } from '@/infrastructure/services/coach-data-aggregator'
import type { UnifiedDataCollector, UnifiedRawData } from '@/infrastructure/services/unified-data-collector'
import type { UnifiedDataTransformer } from '@/infrastructure/services/unified-data-transformer'
import type { CoachAIGenerator, CoachAIOutput } from '@/application/services/coach-ai-generator'

// Mock prisma for resolveTimezone
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

// Mock GeneratePlanUseCase
const mockPlanExecute = vi.fn().mockResolvedValue({
  plan: {
    id: 'plan-1',
    userId: 'user-1',
    planDate: new Date('2026-02-09'),
    coachMessage: '今天加油！',
    capacityNote: '可用時間約 5 小時',
    availableMinutes: 300,
    meetingMinutes: 60,
    plannedMinutes: 240,
    items: [
      { id: 'item-1', planId: 'plan-1', itemType: 'task', taskId: 'task-1', subTaskId: null, content: '完成報告', areaName: '營運', productName: 'Zentropy', estimatedMinutes: 60, dueDate: null, order: 1, reasoning: '優先處理', completed: false, completedAt: null, actualMinutes: null },
      { id: 'item-2', planId: 'plan-1', itemType: 'task', taskId: 'task-2', subTaskId: null, content: '客戶會議準備', areaName: '業務', productName: 'Havital', estimatedMinutes: 45, dueDate: null, order: 2, reasoning: '今日到期', completed: false, completedAt: null, actualMinutes: null },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  timings: { collect: 10, plan: 20, save: 5 },
})

vi.mock('@/application/use-cases/coach/generate-plan', () => ({
  GeneratePlanUseCase: vi.fn().mockImplementation(() => ({
    execute: mockPlanExecute,
  })),
}))

// ============================================================================
// Mock Factories
// ============================================================================

function makeMockRepository(): ICoachBriefingRepository {
  const mockBriefing: CoachBriefingData = {
    id: 'briefing-1',
    userId: 'user-1',
    type: 'MORNING',
    briefingDate: new Date('2026-02-09'),
    calendarEvents: [],
    overdueTasks: [],
    approachingTasks: [],
    conflicts: [],
    stagnations: [],
    completedTasks: [],
    remainingTasks: [],
    tomorrowPreview: [],
    summary: 'AI 摘要',
    recommendations: [],
    deferSuggestions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return {
    create: vi.fn().mockResolvedValue(mockBriefing),
    findLatest: vi.fn().mockResolvedValue(mockBriefing),
    findByDate: vi.fn().mockResolvedValue(null),
    upsertByDate: vi.fn().mockResolvedValue(mockBriefing),
  }
}

function makeMockCollector(): UnifiedDataCollector {
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

  return {
    collect: vi.fn().mockResolvedValue(mockRawData),
  } as any
}

function makeMockTransformer(): UnifiedDataTransformer {
  const mockAggregatedData: AggregatedData = {
    calendarEvents: [],
    overdueTasks: [],
    approachingTasks: [],
    completedTasks: [],
    remainingTasks: [],
    stuckSubTasks: [],
    tomorrowPreview: [],
  }

  return {
    toBriefingData: vi.fn().mockReturnValue(mockAggregatedData),
    toPlanCollectedData: vi.fn().mockReturnValue({}),
  } as any
}

function makeMockAIGenerator(): CoachAIGenerator {
  const mockOutput: CoachAIOutput = {
    summary: '今天沒有特別需要注意的事項。',
    recommendations: [
      { priority: 1, action: '繼續推進目前的任務', reasoning: '一切順利', related_task_id: null },
    ],
    deferSuggestions: [],
  }

  return {
    generate: vi.fn().mockResolvedValue(mockOutput),
  } as any
}

// ============================================================================
// Tests
// ============================================================================

describe('GenerateBriefingUseCase', () => {
  let useCase: GenerateBriefingUseCase
  let mockRepo: ICoachBriefingRepository
  let mockCollector: ReturnType<typeof makeMockCollector>
  let mockTransformer: ReturnType<typeof makeMockTransformer>
  let mockAIGenerator: ReturnType<typeof makeMockAIGenerator>

  beforeEach(() => {
    mockRepo = makeMockRepository()
    mockCollector = makeMockCollector()
    mockTransformer = makeMockTransformer()
    mockAIGenerator = makeMockAIGenerator()
    mockPlanExecute.mockClear()
    useCase = new GenerateBriefingUseCase(mockRepo, mockCollector, mockTransformer, mockAIGenerator)
  })

  describe('正常路徑', () => {
    it('應該成功生成晨報', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
      })

      expect(result.briefing).toBeDefined()
      expect(result.briefing.id).toBe('briefing-1')
      expect(result.timings).toHaveProperty('collect')
      expect(result.timings).toHaveProperty('transform')
      expect(result.timings).toHaveProperty('detection')
      expect(result.timings).toHaveProperty('ai')
      expect(result.timings).toHaveProperty('save')

      // 晨報呼叫 AI generator
      expect(mockCollector.collect).toHaveBeenCalledTimes(1)
      expect(mockTransformer.toBriefingData).toHaveBeenCalledTimes(1)
      expect(mockAIGenerator.generate).toHaveBeenCalledTimes(1)
      expect(mockAIGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MORNING' }),
      )
      expect(mockRepo.upsertByDate).toHaveBeenCalledTimes(1)
    })

    it('應該成功生成晚報', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        type: 'EVENING',
      })

      expect(result.briefing).toBeDefined()
      expect(mockAIGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'EVENING' }),
      )
    })

    it('應該使用指定日期', async () => {
      await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
        date: '2026-02-08',
      })

      expect(mockCollector.collect).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
        'Asia/Taipei',
      )
    })
  })

  describe('偵測整合', () => {
    it('聚合資料中的衝突應該傳給 AI', async () => {
      // 設定有逾期任務的聚合資料
      const aggregatedWithOverdue: AggregatedData = {
        calendarEvents: [{
          id: 'evt-1',
          summary: 'Meeting A',
          start_date_time: '2026-02-09T09:00:00+08:00',
          end_date_time: '2026-02-09T10:00:00+08:00',
          meet_link: null,
          event_link: 'https://cal.google.com/1',
          attendees: [],
          linked_task_id: null,
        }, {
          id: 'evt-2',
          summary: 'Meeting B',
          start_date_time: '2026-02-09T09:30:00+08:00',
          end_date_time: '2026-02-09T10:30:00+08:00',
          meet_link: null,
          event_link: 'https://cal.google.com/2',
          attendees: [],
          linked_task_id: null,
        }],
        overdueTasks: [],
        approachingTasks: [],
        completedTasks: [],
        remainingTasks: [],
            stuckSubTasks: [],
        tomorrowPreview: [],
      }

      ;(mockTransformer.toBriefingData as any).mockReturnValueOnce(aggregatedWithOverdue)

      await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
      })

      // 晨報從 plan 組裝，衝突會在 upsert 資料中
      const upsertCall = (mockRepo.upsertByDate as any).mock.calls[0][0]
      expect(upsertCall.conflicts.length).toBeGreaterThan(0)
      expect(upsertCall.conflicts[0].type).toBe('time_overlap')
    })
  })

  describe('Daily Plan 整合', () => {
    it('晨報應生成 plan 並把結果傳給 AI generator', async () => {
      await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
      })

      // plan 被呼叫
      expect(mockPlanExecute).toHaveBeenCalledTimes(1)

      // AI generator 被呼叫，且帶有 dailyPlan context
      expect(mockAIGenerator.generate).toHaveBeenCalledTimes(1)
      const aiCall = (mockAIGenerator.generate as any).mock.calls[0][0]
      expect(aiCall.type).toBe('MORNING')
      expect(aiCall.dailyPlan).toBeDefined()
      expect(aiCall.dailyPlan.items).toHaveLength(2)
      expect(aiCall.dailyPlan.coachMessage).toBe('今天加油！')
    })

    it('晨報 plan 生成失敗時仍呼叫 AI（無 dailyPlan context）', async () => {
      mockPlanExecute.mockRejectedValueOnce(new Error('Plan failed'))

      const result = await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
      })

      // AI generator 仍被呼叫，但沒有 dailyPlan
      expect(mockAIGenerator.generate).toHaveBeenCalledTimes(1)
      const aiCall = (mockAIGenerator.generate as any).mock.calls[0][0]
      expect(aiCall.dailyPlan).toBeUndefined()

      expect(result.briefing).toBeDefined()
      expect(result.timings).toHaveProperty('plan_error')
    })

    it('晚報應呼叫 AI generator 且不傳 remainingTasks', async () => {
      await useCase.execute({
        userId: 'user-1',
        type: 'EVENING',
      })

      expect(mockPlanExecute).not.toHaveBeenCalled()
      expect(mockAIGenerator.generate).toHaveBeenCalledTimes(1)
      const aiCall = (mockAIGenerator.generate as any).mock.calls[0][0]
      expect(aiCall.type).toBe('EVENING')
      // remainingTasks 應為空陣列，防止 AI 捏造
      expect(aiCall.remainingTasks).toEqual([])
    })
  })

  describe('驗證', () => {
    it('缺少 userId 應該拋出 ValidationException', async () => {
      await expect(
        useCase.execute({ userId: '', type: 'MORNING' }),
      ).rejects.toThrow('User ID is required')
    })

    it('無效的 type 應該拋出 ValidationException', async () => {
      await expect(
        useCase.execute({ userId: 'user-1', type: 'INVALID' as any }),
      ).rejects.toThrow('type must be MORNING or EVENING')
    })

    it('無效日期格式應該拋出 ValidationException', async () => {
      await expect(
        useCase.execute({ userId: 'user-1', type: 'MORNING', date: 'not-a-date' }),
      ).rejects.toThrow('Invalid date format')
    })
  })
})
