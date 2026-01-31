/**
 * ReorderProductsUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReorderProductsUseCase } from '@/application/use-cases/products/reorder-products'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    product: {
      update: vi.fn(),
    },
  },
}))

describe('ReorderProductsUseCase', () => {
  let useCase: ReorderProductsUseCase

  beforeEach(() => {
    useCase = new ReorderProductsUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
          updates: [{ id: 'product-1', display_order: 0 }],
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 updates 不是陣列', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          updates: null as any,
        })
      ).rejects.toThrow('Updates array is required')
    })

    it('應該拋出錯誤當 updates 為空陣列', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          updates: [],
        })
      ).rejects.toThrow('Updates array cannot be empty')
    })

    it('應該拋出錯誤當 update 缺少 id', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          updates: [{ id: '', display_order: 0 }],
        })
      ).rejects.toThrow('Update at index 0 is missing id')
    })

    it('應該拋出錯誤當 display_order 不是數字', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          updates: [{ id: 'product-1', display_order: 'invalid' as any }],
        })
      ).rejects.toThrow('Update at index 0 has invalid display_order (must be a number)')
    })

    it('應該拋出錯誤當 display_order 不是整數', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          updates: [{ id: 'product-1', display_order: 1.5 }],
        })
      ).rejects.toThrow('Update at index 0 has invalid display_order (must be an integer)')
    })
  })

  describe('成功情況', () => {
    it('應該成功批量更新產品排序', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}, {}])

      const result = await useCase.execute({
        userId: 'user-123',
        updates: [
          { id: 'product-1', display_order: 0 },
          { id: 'product-2', display_order: 1 },
          { id: 'product-3', display_order: 2 },
        ],
      })

      expect(result.updated).toBe(3)
      expect(result.message).toBe('Successfully reordered 3 products')
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('應該成功處理單一產品排序', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{}])

      const result = await useCase.execute({
        userId: 'user-123',
        updates: [{ id: 'product-1', display_order: 5 }],
      })

      expect(result.updated).toBe(1)
      expect(result.message).toBe('Successfully reordered 1 products')
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
