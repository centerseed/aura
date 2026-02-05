/**
 * GetMilestonesUseCase 單元測試
 *
 * 🚀 優化後使用單一 JOIN 查詢
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetMilestonesUseCase } from '@/application/use-cases/milestones/get-milestones'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

describe('GetMilestonesUseCase', () => {
  let useCase: GetMilestonesUseCase

  beforeEach(() => {
    useCase = new GetMilestonesUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.$queryRaw).mockReset()
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
      const mockRawRows = [
        {
          milestone_id: 'milestone-1',
          milestone_user_id: 'user-123',
          milestone_name: 'Milestone 1',
          milestone_target_date: new Date('2024-12-31'),
          milestone_entity_type: 'PRODUCT',
          milestone_entity_id: 'product-123',
          milestone_priority: 5,
          milestone_description: null,
          milestone_status: 'planned',
          milestone_created_at: new Date(),
          milestone_updated_at: new Date(),
          milestone_deleted_at: null,
          product_id: 'product-123',
          product_name: 'Test Product',
          area_id: null,
          area_name: null,
          topic_id: null,
          topic_name: null,
        },
      ]

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRawRows)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.milestones.length).toBe(1)
      expect(result.milestones[0].name).toBe('Milestone 1')
      expect(result.milestones[0].product).toEqual({ id: 'product-123', name: 'Test Product' })
      expect(result.milestones[0].area).toBeNull()
      expect(result.milestones[0].topic).toBeNull()
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('應該返回空陣列當用戶沒有 milestones', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.milestones).toEqual([])
    })

    it('應該正確處理多個不同 entity_type 的 milestones', async () => {
      const mockRawRows = [
        {
          milestone_id: 'milestone-1',
          milestone_user_id: 'user-123',
          milestone_name: 'Product Milestone',
          milestone_target_date: new Date('2024-12-31'),
          milestone_entity_type: 'PRODUCT',
          milestone_entity_id: 'product-123',
          milestone_priority: 5,
          milestone_description: null,
          milestone_status: 'planned',
          milestone_created_at: new Date(),
          milestone_updated_at: new Date(),
          milestone_deleted_at: null,
          product_id: 'product-123',
          product_name: 'Test Product',
          area_id: null,
          area_name: null,
          topic_id: null,
          topic_name: null,
        },
        {
          milestone_id: 'milestone-2',
          milestone_user_id: 'user-123',
          milestone_name: 'Area Milestone',
          milestone_target_date: new Date('2024-11-30'),
          milestone_entity_type: 'AREA',
          milestone_entity_id: 'area-456',
          milestone_priority: 7,
          milestone_description: null,
          milestone_status: 'in_progress',
          milestone_created_at: new Date(),
          milestone_updated_at: new Date(),
          milestone_deleted_at: null,
          product_id: null,
          product_name: null,
          area_id: 'area-456',
          area_name: 'Test Area',
          topic_id: null,
          topic_name: null,
        },
      ]

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRawRows)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.milestones.length).toBe(2)
      expect(result.milestones[0].product).toEqual({ id: 'product-123', name: 'Test Product' })
      expect(result.milestones[0].area).toBeNull()
      expect(result.milestones[1].area).toEqual({ id: 'area-456', name: 'Test Area' })
      expect(result.milestones[1].product).toBeNull()
    })
  })
})
