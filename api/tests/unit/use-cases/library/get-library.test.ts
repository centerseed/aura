/**
 * GetLibraryUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetLibraryUseCase } from '@/application/use-cases/library/get-library'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

describe('GetLibraryUseCase', () => {
  let useCase: GetLibraryUseCase

  beforeEach(() => {
    useCase = new GetLibraryUseCase()
    vi.clearAllMocks()
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
    it('應該成功返回完整的層級結構', async () => {
      // Mock raw SQL 返回的資料格式
      const mockRawRows = [
        {
          area_id: 'area-1',
          area_name: 'Work',
          area_description: null,
          area_scope: 'work',
          product_id: 'product-1',
          product_name: 'Project A',
          product_description: null,
          product_status: 'ACTIVE',
          product_lifecycle: 'FINITE',
          product_references: [],
          product_display_order: 0,
          task_id: 'task-1',
          task_content: 'Task content',
          task_status: 'ACTIVE',
          task_ai_analysis: null,
          task_sub_items: [],
          task_references: [],
          task_start_date: null,
          task_due_date: null,
          task_time_confidence: null,
          task_inferred_from_milestone: null,
          task_created_at: new Date(),
          task_updated_at: new Date(),
          topic_name: null,
        },
      ]

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRawRows)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.areas.length).toBe(1)
      expect(result.areas[0].products.length).toBe(1)
      expect(result.areas[0].products[0].tasks.length).toBe(1)
    })

    it('應該返回空結構當沒有資料', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.areas).toEqual([])
    })
  })
})
