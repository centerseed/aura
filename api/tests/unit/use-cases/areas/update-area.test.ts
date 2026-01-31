/**
 * UpdateAreaUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateAreaUseCase } from '@/application/use-cases/areas/update-area'
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

describe('UpdateAreaUseCase', () => {
  let useCase: UpdateAreaUseCase

  beforeEach(() => {
    useCase = new UpdateAreaUseCase()
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 areaId 為空', async () => {
      await expect(
        useCase.execute({
          areaId: '',
          userId: 'user-123',
          name: 'Updated Area',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          areaId: 'area-123',
          userId: '',
          name: 'Updated Area',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Area 不存在', async () => {
      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          areaId: 'area-123',
          userId: 'user-123',
          name: 'Updated Area',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當新名稱已存在', async () => {
      const existingArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Old Name',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const duplicateArea = {
        id: 'area-456',
        user_id: 'user-123',
        name: 'New Name',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      vi.mocked(prisma.area.findFirst)
        .mockResolvedValueOnce(existingArea)
        .mockResolvedValueOnce(duplicateArea)

      await expect(
        useCase.execute({
          areaId: 'area-123',
          userId: 'user-123',
          name: 'New Name',
        })
      ).rejects.toThrow('Area with this name already exists')
    })
  })

  describe('成功情況', () => {
    it('應該成功更新 Area 名稱', async () => {
      const existingArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Old Name',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const updatedArea = {
        ...existingArea,
        name: 'Updated Name',
      }

      vi.mocked(prisma.area.findFirst)
        .mockResolvedValueOnce(existingArea)
        .mockResolvedValueOnce(null) // No duplicate

      vi.mocked(prisma.area.update).mockResolvedValue(updatedArea)

      const result = await useCase.execute({
        areaId: 'area-123',
        userId: 'user-123',
        name: 'Updated Name',
      })

      expect(result.area.name).toBe('Updated Name')
      expect(result.message).toBe('Area updated successfully')
      expect(prisma.area.update).toHaveBeenCalledWith({
        where: { id: 'area-123' },
        data: expect.objectContaining({
          name: 'Updated Name',
        }),
      })
    })

    it('應該成功更新 Area scope', async () => {
      const existingArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const updatedArea = {
        ...existingArea,
        scope: 'personal',
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(existingArea)
      vi.mocked(prisma.area.update).mockResolvedValue(updatedArea)

      const result = await useCase.execute({
        areaId: 'area-123',
        userId: 'user-123',
        scope: 'personal',
      })

      expect(result.area.scope).toBe('personal')
    })

    it('應該成功更新 Area description', async () => {
      const existingArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      const updatedArea = {
        ...existingArea,
        description: 'New description',
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(existingArea)
      vi.mocked(prisma.area.update).mockResolvedValue(updatedArea)

      const result = await useCase.execute({
        areaId: 'area-123',
        userId: 'user-123',
        description: 'New description',
      })

      expect(result.area.description).toBe('New description')
    })

    it('應該允許更新為相同名稱', async () => {
      const existingArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Same Name',
        scope: 'work',
        description: null,
        is_custom: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(existingArea)
      vi.mocked(prisma.area.update).mockResolvedValue(existingArea)

      const result = await useCase.execute({
        areaId: 'area-123',
        userId: 'user-123',
        name: 'Same Name',
        description: 'Updated description',
      })

      expect(result.area).toBeDefined()
      expect(result.message).toBe('Area updated successfully')
    })
  })
})
