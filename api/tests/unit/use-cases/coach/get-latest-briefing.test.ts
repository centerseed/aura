/**
 * GetLatestBriefingUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetLatestBriefingUseCase } from '@/application/use-cases/coach/get-latest-briefing'
import type { ICoachBriefingRepository, CoachBriefingData } from '@/domain/interfaces/coach-briefing-repository'

// ============================================================================
// Mock resolveTimezone & toDateOnly
// ============================================================================

vi.mock('@/lib/timezone-utils', () => ({
  resolveTimezone: vi.fn().mockResolvedValue('Asia/Taipei'),
  toDateOnly: vi.fn().mockReturnValue('2026-02-17'),
}))

// Mock GenerateBriefingUseCase to avoid real AI/DB calls
const mockGenerateExecute = vi.fn()
vi.mock('@/application/use-cases/coach/generate-briefing', () => ({
  GenerateBriefingUseCase: vi.fn().mockImplementation(() => ({
    execute: mockGenerateExecute,
  })),
}))

// ============================================================================
// Mock data
// ============================================================================

const mockBriefing: CoachBriefingData = {
  id: 'briefing-1',
  userId: 'user-1',
  type: 'MORNING',
  briefingDate: new Date('2026-02-17'),
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
    findByDate: vi.fn().mockResolvedValue(null),
    upsertByDate: vi.fn(),
    removeTaskFromBriefing: vi.fn(),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('GetLatestBriefingUseCase', () => {
  let useCase: GetLatestBriefingUseCase
  let mockRepo: ICoachBriefingRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = makeMockRepository()
    useCase = new GetLatestBriefingUseCase(mockRepo)
  })

  describe('今天有 briefing → 直接用', () => {
    it('應該回傳今天的 briefing', async () => {
      ;(mockRepo.findByDate as any).mockResolvedValue(mockBriefing)

      const result = await useCase.execute({ userId: 'user-1', type: 'MORNING' })

      expect(result.briefing).toBeDefined()
      expect(result.briefing?.id).toBe('briefing-1')
      expect(mockRepo.findByDate).toHaveBeenCalledWith('user-1', 'MORNING', expect.any(Date))
      expect(mockGenerateExecute).not.toHaveBeenCalled()
    })

    it('沒指定 type 時預設 MORNING', async () => {
      ;(mockRepo.findByDate as any).mockResolvedValue(mockBriefing)

      await useCase.execute({ userId: 'user-1' })

      expect(mockRepo.findByDate).toHaveBeenCalledWith('user-1', 'MORNING', expect.any(Date))
    })
  })

  describe('今天沒有 briefing → 自動生成', () => {
    it('應該自動生成並回傳 generated=true', async () => {
      const generatedBriefing = { ...mockBriefing, id: 'briefing-new' }
      mockGenerateExecute.mockResolvedValue({ briefing: generatedBriefing, timings: {} })

      const result = await useCase.execute({ userId: 'user-1', type: 'MORNING' })

      expect(result.briefing?.id).toBe('briefing-new')
      expect(result.generated).toBe(true)
      expect(mockGenerateExecute).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'MORNING',
        timezone: 'Asia/Taipei',
      })
    })

    it('生成失敗時 fallback 到最新的', async () => {
      mockGenerateExecute.mockRejectedValue(new Error('AI error'))

      const result = await useCase.execute({ userId: 'user-1', type: 'MORNING' })

      expect(result.briefing?.id).toBe('briefing-1')
      expect(mockRepo.findLatest).toHaveBeenCalledWith('user-1', 'MORNING')
    })

    it('生成失敗且無 fallback 時回傳 null', async () => {
      mockGenerateExecute.mockRejectedValue(new Error('AI error'))
      ;(mockRepo.findLatest as any).mockResolvedValue(null)

      const result = await useCase.execute({ userId: 'user-1', type: 'MORNING' })

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
