/**
 * UpdateMilestoneUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateMilestoneUseCase } from '@/application/use-cases/milestones/update-milestone'
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

describe('UpdateMilestoneUseCase', () => {
  let useCase: UpdateMilestoneUseCase

  beforeEach(() => {
    useCase = new UpdateMilestoneUseCase()
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
          name: 'Updated Name',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: '',
          name: 'Updated Name',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 name 為空字串', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
          name: '   ',
        })
      ).rejects.toThrow('Name cannot be empty')
    })

    it('應該拋出錯誤當 name 超過 200 字元', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
          name: 'a'.repeat(201),
        })
      ).rejects.toThrow('Name must not exceed 200 characters')
    })

    it('應該拋出錯誤當 target_date 格式無效', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
          target_date: 'invalid-date',
        })
      ).rejects.toThrow('Invalid date format')
    })

    it('應該拋出錯誤當 entity_type 無效', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
          entity_type: 'INVALID' as any,
        })
      ).rejects.toThrow('Entity type must be AREA, PRODUCT, or TOPIC')
    })

    it('應該拋出錯誤當 status 無效', async () => {
      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
          status: 'invalid' as any,
        })
      ).rejects.toThrow('Status must be one of')
    })

    it('應該拋出錯誤當 Milestone 不存在', async () => {
      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          milestoneId: 'milestone-123',
          userId: 'user-123',
          name: 'Updated Name',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功更新 milestone 的 name', async () => {
      const existingMilestone = {
        id: 'milestone-123',
        user_id: 'user-123',
        name: 'Old Name',
        target_date: new Date('2024-12-31'),
        entity_type: 'PRODUCT',
        entity_id: 'product-123',
        description: null,
        status: 'planned',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const updatedMilestone = {
        ...existingMilestone,
        name: 'New Name',
        updated_at: new Date(),
      }

      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(existingMilestone as any)
      vi.mocked(prisma.milestone.update).mockResolvedValue(updatedMilestone as any)

      const result = await useCase.execute({
        milestoneId: 'milestone-123',
        userId: 'user-123',
        name: 'New Name',
      })

      expect(result.milestone.name).toBe('New Name')
      expect(result.message).toBe('Milestone updated successfully')
      expect(prisma.milestone.update).toHaveBeenCalledWith({
        where: { id: 'milestone-123' },
        data: expect.objectContaining({
          name: 'New Name',
        }),
      })
    })

    it('應該成功更新 milestone 的 status', async () => {
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

      const updatedMilestone = {
        ...existingMilestone,
        status: 'completed',
        updated_at: new Date(),
      }

      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(existingMilestone as any)
      vi.mocked(prisma.milestone.update).mockResolvedValue(updatedMilestone as any)

      const result = await useCase.execute({
        milestoneId: 'milestone-123',
        userId: 'user-123',
        status: 'completed',
      })

      expect(result.milestone.status).toBe('completed')
    })

    it('應該成功更新多個欄位', async () => {
      const existingMilestone = {
        id: 'milestone-123',
        user_id: 'user-123',
        name: 'Old Name',
        target_date: new Date('2024-12-31'),
        entity_type: 'PRODUCT',
        entity_id: 'product-123',
        description: null,
        status: 'planned',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const updatedMilestone = {
        ...existingMilestone,
        name: 'New Name',
        status: 'in_progress',
        description: 'Updated description',
        updated_at: new Date(),
      }

      vi.mocked(prisma.milestone.findFirst).mockResolvedValue(existingMilestone as any)
      vi.mocked(prisma.milestone.update).mockResolvedValue(updatedMilestone as any)

      const result = await useCase.execute({
        milestoneId: 'milestone-123',
        userId: 'user-123',
        name: 'New Name',
        status: 'in_progress',
        description: 'Updated description',
      })

      expect(result.milestone.name).toBe('New Name')
      expect(result.milestone.status).toBe('in_progress')
      expect(result.milestone.description).toBe('Updated description')
    })
  })
})
