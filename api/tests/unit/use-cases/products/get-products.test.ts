/**
 * GetProductsUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetProductsUseCase } from '@/application/use-cases/products/get-products'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

describe('GetProductsUseCase', () => {
  let useCase: GetProductsUseCase

  beforeEach(() => {
    useCase = new GetProductsUseCase()
    vi.clearAllMocks()
  })

  describe('成功情況', () => {
    it('應該返回用戶的所有 products', async () => {
      const now = new Date()
      // Mock raw SQL 返回的資料格式
      const mockRawRows = [
        {
          product_id: 'product-1',
          product_user_id: 'user-123',
          product_area_id: 'area-123',
          product_name: 'Product 1',
          product_description: null,
          product_status: 'ACTIVE',
          product_lifecycle: 'FINITE',
          product_display_order: 0,
          product_references: [],
          product_created_at: now,
          product_updated_at: now,
          area_id: 'area-123',
          area_name: 'Test Area',
          area_scope: 'work',
          area_description: null,
          task_id: null,
          task_user_id: null,
          task_product_id: null,
          task_topic_id: null,
          task_content: null,
          task_status: null,
          task_due_date: null,
          task_start_date: null,
          task_time_confidence: null,
          task_inferred_from_milestone: null,
          task_ai_analysis: null,
          task_sub_items: null,
          task_references: null,
          task_created_at: null,
          task_updated_at: null,
          topic_name: null,
        },
      ]

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRawRows)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.products.length).toBe(1)
      expect(result.products[0].id).toBe('product-1')
      expect(result.products[0].name).toBe('Product 1')
      expect(result.products[0].area?.name).toBe('Test Area')
    })

    it('應該返回空陣列當用戶沒有 products', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.products).toEqual([])
      expect(result.products.length).toBe(0)
    })
  })
})
