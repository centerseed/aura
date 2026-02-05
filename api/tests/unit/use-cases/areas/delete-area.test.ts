/**
 * DeleteAreaUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteAreaUseCase } from '@/application/use-cases/areas/delete-area'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    area: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { ConflictException } from '@/lib/api-response'

describe('DeleteAreaUseCase', () => {
  let useCase: DeleteAreaUseCase

  beforeEach(() => {
    useCase = new DeleteAreaUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.area.findFirst).mockReset()
    vi.mocked(prisma.area.update).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 areaId 為空', async () => {
      await expect(
        useCase.execute({
          areaId: '',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          areaId: 'area-123',
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Area 不存在', async () => {
      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          areaId: 'area-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 Area 下還有 Products', async () => {
      // 🚀 優化：使用 _count 格式而非 include products
      const areaWithProducts = {
        id: 'area-123',
        _count: { products: 1 },
      } as any

      vi.mocked(prisma.area.findFirst).mockResolvedValue(areaWithProducts)

      await expect(
        useCase.execute({
          areaId: 'area-123',
          userId: 'user-123',
        })
      ).rejects.toThrow('Cannot delete area with existing products')
    })
  })

  describe('成功情況', () => {
    it('應該成功軟刪除 Area', async () => {
      // 🚀 優化：使用 _count 格式
      const areaWithNoProducts = {
        id: 'area-123',
        _count: { products: 0 },
      } as any

      const deletedArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: new Date(),
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(areaWithNoProducts)
      vi.mocked(prisma.area.update).mockResolvedValue(deletedArea)

      const result = await useCase.execute({
        areaId: 'area-123',
        userId: 'user-123',
      })

      expect(result.areaId).toBe('area-123')
      expect(result.message).toBe('Area deleted successfully')
      expect(prisma.area.update).toHaveBeenCalledWith({
        where: { id: 'area-123' },
        data: expect.objectContaining({
          deleted_at: expect.any(Date),
        }),
      })
    })
  })
})
