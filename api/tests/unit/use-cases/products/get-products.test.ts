/**
 * GetProductsUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetProductsUseCase } from '@/application/use-cases/products/get-products'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}))

describe('GetProductsUseCase', () => {
  let useCase: GetProductsUseCase

  beforeEach(() => {
    useCase = new GetProductsUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockReset()
  })

  describe('成功情況', () => {
    it('應該返回用戶的所有 products', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          user_id: 'user-123',
          area_id: 'area-123',
          name: 'Product 1',
          description: null,
          status: 'ACTIVE' as const,
          lifecycle: 'FINITE' as const,
          display_order: 0,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          area: {
            id: 'area-123',
            name: 'Test Area',
            scope: 'work',
          },
        },
      ] as any

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.products).toEqual(mockProducts)
      expect(result.products.length).toBe(1)
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-123', deleted_at: null },
        orderBy: [{ display_order: 'asc' }, { created_at: 'desc' }],
      })
    })

    it('應該返回空陣列當用戶沒有 products', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.products).toEqual([])
      expect(result.products.length).toBe(0)
    })
  })
})
