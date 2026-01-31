/**
 * UpdateEvaluationLogUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateEvaluationLogUseCase } from '@/application/use-cases/evaluation/update-log'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    systemEvaluationLog: {
      update: vi.fn(),
    },
  },
}))

describe('UpdateEvaluationLogUseCase', () => {
  let useCase: UpdateEvaluationLogUseCase

  beforeEach(() => {
    useCase = new UpdateEvaluationLogUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.systemEvaluationLog.update).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 logId', async () => {
      await expect(
        useCase.execute({
          logId: '',
          userAction: 'APPLIED',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 userAction', async () => {
      await expect(
        useCase.execute({
          logId: 'log-123',
          userAction: '' as any,
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 userAction 無效', async () => {
      await expect(
        useCase.execute({
          logId: 'log-123',
          userAction: 'INVALID' as any,
        })
      ).rejects.toThrow('User action must be one of')
    })
  })

  describe('成功情況', () => {
    it('應該成功更新評估日誌', async () => {
      const mockLog = {
        id: 'log-123',
        user_id: 'user-123',
        type: 'task_analysis',
        input_content: {},
        output_content: {},
        user_action: 'APPLIED',
        metadata: {},
        created_at: new Date(),
      }

      vi.mocked(prisma.systemEvaluationLog.update).mockResolvedValue(mockLog as any)

      const result = await useCase.execute({
        logId: 'log-123',
        userAction: 'APPLIED',
      })

      expect(result.log.user_action).toBe('APPLIED')
      expect(result.message).toBe('Evaluation log updated successfully')
    })
  })
})
