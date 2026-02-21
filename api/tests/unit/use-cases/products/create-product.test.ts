/**
 * CreateProductUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateProductUseCase } from '@/application/use-cases/products/create-product'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { VALID_USER_ID, VALID_AREA_ID, VALID_PRODUCT_ID } from '../../../helpers/test-uuids'

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

// Mock embedding
const mockEnsureProductEmbedding = vi.fn()
vi.mock('@/lib/embedding', () => ({
  ensureProductEmbedding: (...args: any[]) => mockEnsureProductEmbedding(...args),
}))

describe('CreateProductUseCase', () => {
  let useCase: CreateProductUseCase

  beforeEach(() => {
    useCase = new CreateProductUseCase()
    vi.clearAllMocks()
    mockEnsureProductEmbedding.mockResolvedValue(undefined)
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          userId: '',
          areaId: VALID_AREA_ID,
          name: 'Test Product',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 areaId 為空', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          areaId: '',
          name: 'Test Product',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 name 為空', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          areaId: VALID_AREA_ID,
          name: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Area 不存在', async () => {
      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          areaId: VALID_AREA_ID,
          name: 'Test Product',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功創建 Product', async () => {
      const mockArea = {
        id: VALID_AREA_ID,
        user_id: VALID_USER_ID,
        name: 'Test Area',
        scope: 'work',
        description: null,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockProduct = {
        id: VALID_PRODUCT_ID,
        user_id: VALID_USER_ID,
        area_id: VALID_AREA_ID,
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
        userId: VALID_USER_ID,
        areaId: VALID_AREA_ID,
        name: 'Test Product',
        description: 'Test description',
      })

      expect(result.product).toEqual(mockProduct)
      expect(result.message).toBe('Product created successfully')
    })

    it('🔴 迴歸測試：創建 Product 後必須呼叫 ensureProductEmbedding', async () => {
      const mockArea = {
        id: VALID_AREA_ID,
        user_id: VALID_USER_ID,
        name: 'Test Area',
        scope: 'work',
        description: null,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockProduct = {
        id: VALID_PRODUCT_ID,
        user_id: VALID_USER_ID,
        area_id: VALID_AREA_ID,
        name: 'Test Product',
        description: 'Test description',
        status: 'ACTIVE' as const,
        lifecycle: 'FINITE' as const,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        area: mockArea,
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(mockArea)
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.product.create).mockResolvedValue(mockProduct)

      await useCase.execute({
        userId: VALID_USER_ID,
        areaId: VALID_AREA_ID,
        name: 'Test Product',
        description: 'Test description',
      })

      expect(mockEnsureProductEmbedding).toHaveBeenCalledTimes(1)
      expect(mockEnsureProductEmbedding).toHaveBeenCalledWith(
        VALID_PRODUCT_ID,
        'Test Product',
        'Test description'
      )
    })
  })
})
