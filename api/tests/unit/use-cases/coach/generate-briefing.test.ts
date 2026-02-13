/**
 * GenerateBriefingUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateBriefingUseCase } from '@/application/use-cases/coach/generate-briefing'
import type { ICoachBriefingRepository, CoachBriefingData, CreateCoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'
import type { CoachDataAggregator, AggregatedData } from '@/infrastructure/services/coach-data-aggregator'
import type { CoachAIGenerator, CoachAIOutput } from '@/application/services/coach-ai-generator'

// Mock prisma for resolveTimezone
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
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

function makeMockAggregator(): CoachDataAggregator {
  const mockData: AggregatedData = {
    calendarEvents: [],
    overdueTasks: [],
    approachingTasks: [],
    completedTasks: [],
    remainingTasks: [],
    stagnantProducts: [],
    stuckSubTasks: [],
    tomorrowPreview: [],
  }

  return {
    aggregate: vi.fn().mockResolvedValue(mockData),
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
  let mockAggregator: ReturnType<typeof makeMockAggregator>
  let mockAIGenerator: ReturnType<typeof makeMockAIGenerator>

  beforeEach(() => {
    mockRepo = makeMockRepository()
    mockAggregator = makeMockAggregator()
    mockAIGenerator = makeMockAIGenerator()
    useCase = new GenerateBriefingUseCase(mockRepo, mockAggregator, mockAIGenerator)
  })

  describe('正常路徑', () => {
    it('應該成功生成晨報', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
      })

      expect(result.briefing).toBeDefined()
      expect(result.briefing.id).toBe('briefing-1')
      expect(result.timings).toHaveProperty('aggregate')
      expect(result.timings).toHaveProperty('detection')
      expect(result.timings).toHaveProperty('ai')
      expect(result.timings).toHaveProperty('save')

      // 驗證流程
      expect(mockAggregator.aggregate).toHaveBeenCalledTimes(1)
      expect(mockAIGenerator.generate).toHaveBeenCalledTimes(1)
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

      expect(mockAggregator.aggregate).toHaveBeenCalledWith(
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
        stagnantProducts: [],
        stuckSubTasks: [],
        tomorrowPreview: [],
      }

      ;(mockAggregator.aggregate as any).mockResolvedValue(aggregatedWithOverdue)

      await useCase.execute({
        userId: 'user-1',
        type: 'MORNING',
      })

      // AI 應該收到偵測到的衝突
      const aiCall = (mockAIGenerator.generate as any).mock.calls[0][0]
      expect(aiCall.conflicts.length).toBeGreaterThan(0)
      expect(aiCall.conflicts[0].type).toBe('time_overlap')
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
