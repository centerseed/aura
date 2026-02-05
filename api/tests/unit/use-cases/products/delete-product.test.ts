/**
 * DeleteProductUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteProductUseCase } from '@/application/use-cases/products/delete-product'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { ConflictException } from '@/lib/api-response'

describe('DeleteProductUseCase', () => {
  let useCase: DeleteProductUseCase

  beforeEach(() => {
    useCase = new DeleteProductUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.product.findFirst).mockReset()
    vi.mocked(prisma.product.update).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 productId 為空', async () => {
      await expect(
        useCase.execute({
          productId: '',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Product 不存在', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 Product 下還有 active Tasks', async () => {
      // 🚀 優化：使用 _count 格式而非 include tasks
      const productWithTasks = {
        id: 'product-123',
        _count: { tasks: 1 },
      } as any

      vi.mocked(prisma.product.findFirst).mockResolvedValue(productWithTasks)

      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: 'user-123',
        })
      ).rejects.toThrow('無法刪除此專案，因為還有 1 個進行中的任務')
    })
  })

  describe('成功情況', () => {
    it('應該成功軟刪除 Product', async () => {
      // 🚀 優化：使用 _count 格式
      const productWithNoTasks = {
        id: 'product-123',
        _count: { tasks: 0 },
      } as any

      const deletedProduct = {
        id: 'product-123',
        user_id: 'user-123',
        area_id: 'area-123',
        name: 'Test Product',
        description: null,
        status: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: new Date(),
      }

      vi.mocked(prisma.product.findFirst).mockResolvedValue(productWithNoTasks)
      vi.mocked(prisma.product.update).mockResolvedValue(deletedProduct)

      const result = await useCase.execute({
        productId: 'product-123',
        userId: 'user-123',
      })

      expect(result.productId).toBe('product-123')
      expect(result.message).toBe('Product deleted successfully')
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-123' },
        data: expect.objectContaining({
          deleted_at: expect.any(Date),
        }),
      })
    })
  })
})
