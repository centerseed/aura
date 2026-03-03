/**
 * DeleteMilestoneUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteMilestoneUseCase } from '@/application/use-cases/milestones/delete-milestone'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    milestone: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('DeleteMilestoneUseCase', () => {
  let useCase: DeleteMilestoneUseCase

  beforeEach(() => {
    useCase = new DeleteMilestoneUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.milestone.findFirst).mockReset()
    vi.mocked(prisma.milestone.update).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 milestoneId', async () => {
      await expect(
        useCase.execute({
          milestoneId: '',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Milestone 不存在', async () => {
      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功軟刪除 milestone', async () => {
      const existingMilestone = {
        id: 'milestone-123',
        user_id: 'user-123',
        name: 'Test Milestone',
        target_date: new Date('2024-12-31'),
        entity_type: 'PRODUCT',
        entity_id: 'product-123',
        description: null,
        status: 'planned',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const deletedMilestone = {
        ...existingMilestone,
        deleted_at: new Date(),
      }

      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(existingMilestone as any)
      vi.mocked(prisma.milestone.update).mockResolvedValue(deletedMilestone as any)

      const result = await useCase.execute({
        milestoneId: 'milestone-123',
        userId: 'user-123',
      })

      expect(result.milestoneId).toBe('milestone-123')
      expect(result.message).toBe('Milestone deleted successfully')
      expect(prisma.milestone.update).toHaveBeenCalledWith({
        where: { id: 'milestone-123' },
        data: expect.objectContaining({
          deleted_at: expect.any(Date),
        }),
      })
    })

    it('應該驗證用戶權限', async () => {
      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'different-user',
        })
      ).rejects.toThrow(NotFoundException)

      expect(prisma.milestone.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'milestone-123',
          user_id: 'different-user',
          deleted_at: null,
        },
      })
    })
  })
})
