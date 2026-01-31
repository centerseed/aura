/**
 * GetMilestonesUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetMilestonesUseCase } from '@/application/use-cases/milestones/get-milestones'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    milestone: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    area: {
      findMany: vi.fn(),
    },
    topic: {
      findMany: vi.fn(),
    },
  },
}))

describe('GetMilestonesUseCase', () => {
  let useCase: GetMilestonesUseCase

  beforeEach(() => {
    useCase = new GetMilestonesUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.milestone.findMany).mockReset()
    vi.mocked(prisma.product.findMany).mockReset()
    vi.mocked(prisma.area.findMany).mockReset()
    vi.mocked(prisma.topic.findMany).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })
  })

  describe('成功情況', () => {
    it('應該返回用戶的所有 milestones', async () => {
      const mockMilestones = [
        {
          id: 'milestone-1',
          user_id: 'user-123',
          name: 'Milestone 1',
          target_date: new Date('2024-12-31'),
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
          priority: 5,
          description: null,
          status: 'planned',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ]

      const mockProducts = [
        {
          id: 'product-123',
          name: 'Test Product',
        },
      ]

      vi.mocked(prisma.milestone.findMany).mockResolvedValue(mockMilestones as any)
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)
      vi.mocked(prisma.area.findMany).mockResolvedValue([])
      vi.mocked(prisma.topic.findMany).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.milestones.length).toBe(1)
      expect(result.milestones[0].name).toBe('Milestone 1')
      expect(result.milestones[0].product).toEqual({ id: 'product-123', name: 'Test Product' })
      expect(result.milestones[0].area).toBeNull()
      expect(result.milestones[0].topic).toBeNull()
      expect(prisma.milestone.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-123', deleted_at: null },
        orderBy: { target_date: 'asc' },
      })
    })

    it('應該返回空陣列當用戶沒有 milestones', async () => {
      vi.mocked(prisma.milestone.findMany).mockResolvedValue([])
      vi.mocked(prisma.product.findMany).mockResolvedValue([])
      vi.mocked(prisma.area.findMany).mockResolvedValue([])
      vi.mocked(prisma.topic.findMany).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.milestones).toEqual([])
    })

    it('應該正確處理多個不同 entity_type 的 milestones', async () => {
      const mockMilestones = [
        {
          id: 'milestone-1',
          user_id: 'user-123',
          name: 'Product Milestone',
          target_date: new Date('2024-12-31'),
          entity_type: 'PRODUCT',
          entity_id: 'product-123',
          priority: 5,
          description: null,
          status: 'planned',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 'milestone-2',
          user_id: 'user-123',
          name: 'Area Milestone',
          target_date: new Date('2024-11-30'),
          entity_type: 'AREA',
          entity_id: 'area-456',
          priority: 7,
          description: null,
          status: 'in_progress',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ]

      const mockProducts = [{ id: 'product-123', name: 'Test Product' }]
      const mockAreas = [{ id: 'area-456', name: 'Test Area' }]

      vi.mocked(prisma.milestone.findMany).mockResolvedValue(mockMilestones as any)
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)
      vi.mocked(prisma.area.findMany).mockResolvedValue(mockAreas as any)
      vi.mocked(prisma.topic.findMany).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.milestones.length).toBe(2)
      expect(result.milestones[0].product).toEqual({ id: 'product-123', name: 'Test Product' })
      expect(result.milestones[0].area).toBeNull()
      expect(result.milestones[1].area).toEqual({ id: 'area-456', name: 'Test Area' })
      expect(result.milestones[1].product).toBeNull()
    })
  })
})
