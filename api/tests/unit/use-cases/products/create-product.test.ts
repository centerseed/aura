/**
 * CreateProductUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateProductUseCase } from '@/application/use-cases/products/create-product'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    area: {
      findFirst: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('CreateProductUseCase', () => {
  let useCase: CreateProductUseCase

  beforeEach(() => {
    useCase = new CreateProductUseCase()
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          userId: '',
          areaId: 'area-123',
          name: 'Test Product',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 areaId 為空', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          areaId: '',
          name: 'Test Product',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 name 為空', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          areaId: 'area-123',
          name: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Area 不存在', async () => {
      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          userId: 'user-123',
          areaId: 'area-123',
          name: 'Test Product',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功創建 Product', async () => {
      const mockArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: null,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockProduct = {
        id: 'product-123',
        user_id: 'user-123',
        area_id: 'area-123',
        name: 'Test Product',
        description: null,
        status: 'ACTIVE' as const,
        lifecycle: 'MAINTAIN' as const,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        area: mockArea,
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(mockArea)
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.product.create).mockResolvedValue(mockProduct)

      const result = await useCase.execute({
        userId: 'user-123',
        areaId: 'area-123',
        name: 'Test Product',
        description: 'Test description',
      })

      expect(result.product).toEqual(mockProduct)
      expect(result.message).toBe('Product created successfully')
    })
  })
})
