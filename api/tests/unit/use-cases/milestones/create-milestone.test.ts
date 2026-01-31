/**
 * CreateMilestoneUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateMilestoneUseCase } from '@/application/use-cases/milestones/create-milestone'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    milestone: {
      create: vi.fn(),
    },
  },
}))

describe('CreateMilestoneUseCase', () => {
  let useCase: CreateMilestoneUseCase

  beforeEach(() => {
    useCase = new CreateMilestoneUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.milestone.create).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
          name: 'Test Milestone',
          target_date: '2024-12-31',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 name 為空', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: '   ',
          target_date: '2024-12-31',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
        })
      ).rejects.toThrow('Name is required')
    })

    it('應該拋出錯誤當 name 超過 200 字元', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'a'.repeat(201),
          target_date: '2024-12-31',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
        })
      ).rejects.toThrow('Name must not exceed 200 characters')
    })

    it('應該拋出錯誤當沒有提供 target_date', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Milestone',
          target_date: '',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
        })
      ).rejects.toThrow('Target date is required')
    })

    it('應該拋出錯誤當 target_date 格式無效', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Milestone',
          target_date: 'invalid-date',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
        })
      ).rejects.toThrow('Invalid date format')
    })

    it('應該拋出錯誤當 entity_type 無效', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Milestone',
          target_date: '2024-12-31',
          entity_type: 'INVALID' as any,
          entity_id: 'entity-123',
        })
      ).rejects.toThrow('Entity type must be AREA, PRODUCT, or TOPIC')
    })

    it('應該拋出錯誤當沒有提供 entity_id', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Milestone',
          target_date: '2024-12-31',
          entity_type: 'PRODUCT',
          entity_id: '',
        })
      ).rejects.toThrow('Entity ID is required')
    })

    it('應該拋出錯誤當 priority 超出範圍', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Milestone',
          target_date: '2024-12-31',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
          priority: 11,
        })
      ).rejects.toThrow('Priority must be an integer between 1 and 10')
    })

    it('應該拋出錯誤當 status 無效', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Milestone',
          target_date: '2024-12-31',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
          status: 'invalid' as any,
        })
      ).rejects.toThrow('Status must be one of')
    })
  })

  describe('成功情況', () => {
    it('應該成功創建 milestone', async () => {
      const mockMilestone = {
        id: 'milestone-123',
        user_id: 'user-123',
        name: 'Test Milestone',
        target_date: new Date('2024-12-31'),
        entity_type: 'PRODUCT',
        entity_id: 'product-123',
        priority: 5,
        description: null,
        status: 'planned',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      vi.mocked(prisma.milestone.create).mockResolvedValue(mockMilestone as any)

      const result = await useCase.execute({
        userId: 'user-123',
        name: 'Test Milestone',
        target_date: '2024-12-31',
        entity_type: 'PRODUCT',
        entity_id: 'product-123',
      })

      expect(result.milestone).toEqual(mockMilestone)
      expect(result.message).toBe('Milestone created successfully')
      expect(prisma.milestone.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-123',
          name: 'Test Milestone',
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
          priority: 5,
          status: 'planned',
        }),
      })
    })

    it('應該使用自訂的 priority 和 status', async () => {
      const mockMilestone = {
        id: 'milestone-123',
        user_id: 'user-123',
        name: 'Test Milestone',
        target_date: new Date('2024-12-31'),
        entity_type: 'AREA',
        entity_id: 'area-123',
        priority: 8,
        description: 'Test description',
        status: 'in_progress',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      vi.mocked(prisma.milestone.create).mockResolvedValue(mockMilestone as any)

      const result = await useCase.execute({
        userId: 'user-123',
        name: 'Test Milestone',
        target_date: '2024-12-31',
        entity_type: 'AREA',
        entity_id: 'area-123',
        priority: 8,
        description: 'Test description',
        status: 'in_progress',
      })

      expect(result.milestone.priority).toBe(8)
      expect(result.milestone.status).toBe('in_progress')
      expect(result.milestone.description).toBe('Test description')
    })
  })
})
