/**
 * GetEvaluationLogsUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetEvaluationLogsUseCase } from '@/application/use-cases/evaluation/get-logs'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    systemEvaluationLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('GetEvaluationLogsUseCase', () => {
  let useCase: GetEvaluationLogsUseCase

  beforeEach(() => {
    useCase = new GetEvaluationLogsUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.systemEvaluationLog.count).mockReset()
    vi.mocked(prisma.systemEvaluationLog.findMany).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 limit 超出範圍', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          limit: 101,
        })
      ).rejects.toThrow('Limit must be between 1 and 100')
    })

    it('應該拋出錯誤當 offset 為負數', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          offset: -1,
        })
      ).rejects.toThrow('Offset must be non-negative')
    })
  })

  describe('成功情況', () => {
    it('應該成功返回評估日誌', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-123',
          type: 'task_analysis',
          input_content: {},
          output_content: {},
          user_action: 'PENDING',
          metadata: {},
          created_at: new Date(),
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      ]

      vi.mocked(prisma.systemEvaluationLog.count).mockResolvedValue(1)
      vi.mocked(prisma.systemEvaluationLog.findMany).mockResolvedValue(mockLogs as any)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.total).toBe(1)
      expect(result.logs.length).toBe(1)
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(0)
    })
  })
})
