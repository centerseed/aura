/**
 * GetLatestBriefingUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetLatestBriefingUseCase } from '@/application/use-cases/coach/get-latest-briefing'
import type { ICoachBriefingRepository, CoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'

// ============================================================================
// Mock
// ============================================================================

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
  summary: '今天一切順利。',
  recommendations: [
    { priority: 1, action: '繼續推進', reasoning: '順利', related_task_id: null },
  ],
  deferSuggestions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeMockRepository(): ICoachBriefingRepository {
  return {
    create: vi.fn(),
    findLatest: vi.fn().mockResolvedValue(mockBriefing),
    findByDate: vi.fn(),
    upsertByDate: vi.fn(),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('GetLatestBriefingUseCase', () => {
  let useCase: GetLatestBriefingUseCase
  let mockRepo: ICoachBriefingRepository

  beforeEach(() => {
    mockRepo = makeMockRepository()
    useCase = new GetLatestBriefingUseCase(mockRepo)
  })

  describe('正常路徑', () => {
    it('應該取得最新簡報', async () => {
      const result = await useCase.execute({ userId: 'user-1' })

      expect(result.briefing).toBeDefined()
      expect(result.briefing?.id).toBe('briefing-1')
      expect(mockRepo.findLatest).toHaveBeenCalledWith('user-1', undefined)
    })

    it('應該支援按類型篩選', async () => {
      const result = await useCase.execute({ userId: 'user-1', type: 'EVENING' })

      expect(mockRepo.findLatest).toHaveBeenCalledWith('user-1', 'EVENING')
    })

    it('沒有簡報時應回傳 null', async () => {
      ;(mockRepo.findLatest as any).mockResolvedValue(null)

      const result = await useCase.execute({ userId: 'user-1' })
      expect(result.briefing).toBeNull()
    })
  })

  describe('驗證', () => {
    it('缺少 userId 應該拋出 ValidationException', async () => {
      await expect(
        useCase.execute({ userId: '' }),
      ).rejects.toThrow('User ID is required')
    })

    it('無效的 type 應該拋出 ValidationException', async () => {
      await expect(
        useCase.execute({ userId: 'user-1', type: 'INVALID' as any }),
      ).rejects.toThrow('type must be MORNING or EVENING')
    })
  })
})
