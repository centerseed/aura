/**
 * UpdateProductUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateProductUseCase } from '@/application/use-cases/products/update-product'
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

describe('UpdateProductUseCase', () => {
  let useCase: UpdateProductUseCase

  beforeEach(() => {
    useCase = new UpdateProductUseCase()
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
          name: 'Updated Product',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: '',
          name: 'Updated Product',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當名稱長度為 0', async () => {
      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: 'user-123',
          name: '',
        })
      ).rejects.toThrow('Name must be between 1 and 200 characters')
    })

    it('應該拋出錯誤當名稱超過 200 字元', async () => {
      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: 'user-123',
          name: 'a'.repeat(201),
        })
      ).rejects.toThrow('Name must be between 1 and 200 characters')
    })

    it('應該拋出錯誤當 Product 不存在', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: 'user-123',
          name: 'Updated Product',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當新名稱在同一 Area 已存在', async () => {
      const existingProduct = {
        id: 'product-123',
        user_id: 'user-123',
        area_id: 'area-123',
        name: 'Old Name',
        description: null,
        status: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const duplicateProduct = {
        id: 'product-456',
        user_id: 'user-123',
        area_id: 'area-123',
        name: 'New Name',
        description: null,
        status: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      vi.mocked(prisma.product.findFirst)
        .mockResolvedValueOnce(existingProduct)
        .mockResolvedValueOnce(duplicateProduct)

      await expect(
        useCase.execute({
          productId: 'product-123',
          userId: 'user-123',
          name: 'New Name',
        })
      ).rejects.toThrow('Product with this name already exists in this area')
    })
  })

  describe('成功情況', () => {
    it('應該成功更新 Product 名稱', async () => {
      const existingProduct = {
        id: 'product-123',
        user_id: 'user-123',
        area_id: 'area-123',
        name: 'Old Name',
        description: null,
        status: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const updatedProduct = {
        ...existingProduct,
        name: 'Updated Name',
      }

      vi.mocked(prisma.product.findFirst)
        .mockResolvedValueOnce(existingProduct)
        .mockResolvedValueOnce(null) // No duplicate

      vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

      const result = await useCase.execute({
        productId: 'product-123',
        userId: 'user-123',
        name: 'Updated Name',
      })

      expect(result.product.name).toBe('Updated Name')
      expect(result.message).toBe('Product updated successfully')
    })

    it('應該成功更新 Product status', async () => {
      const existingProduct = {
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
        deleted_at: null,
      }

      const updatedProduct = {
        ...existingProduct,
        status: 'MAINTAIN' as const,
      }

      vi.mocked(prisma.product.findFirst).mockResolvedValue(existingProduct)
      vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

      const result = await useCase.execute({
        productId: 'product-123',
        userId: 'user-123',
        status: 'MAINTAIN',
      })

      expect(result.product.status).toBe('MAINTAIN')
    })

    it('應該成功更新 Product lifecycle', async () => {
      const existingProduct = {
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
        deleted_at: null,
      }

      const updatedProduct = {
        ...existingProduct,
        lifecycle: 'PERPETUAL' as const,
      }

      vi.mocked(prisma.product.findFirst).mockResolvedValue(existingProduct)
      vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

      const result = await useCase.execute({
        productId: 'product-123',
        userId: 'user-123',
        lifecycle: 'PERPETUAL',
      })

      expect(result.product.lifecycle).toBe('PERPETUAL')
    })

    it('應該成功移動 Product 到新 Area', async () => {
      const existingProduct = {
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
        deleted_at: null,
      }

      const updatedProduct = {
        ...existingProduct,
        area_id: 'area-456',
      }

      vi.mocked(prisma.product.findFirst)
        .mockResolvedValueOnce(existingProduct)
        .mockResolvedValueOnce(null) // No duplicate in new area

      vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

      const result = await useCase.execute({
        productId: 'product-123',
        userId: 'user-123',
        areaId: 'area-456',
      })

      expect(result.product.area_id).toBe('area-456')
    })

    it('應該成功更新 Product description', async () => {
      const existingProduct = {
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
        deleted_at: null,
      }

      const updatedProduct = {
        ...existingProduct,
        description: 'New description',
      }

      vi.mocked(prisma.product.findFirst).mockResolvedValue(existingProduct)
      vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

      const result = await useCase.execute({
        productId: 'product-123',
        userId: 'user-123',
        description: 'New description',
      })

      expect(result.product.description).toBe('New description')
    })
  })
})
