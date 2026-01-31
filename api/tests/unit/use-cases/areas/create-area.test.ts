/**
 * CreateAreaUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateAreaUseCase } from '@/application/use-cases/areas/create-area'
import { ValidationException, ConflictException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    area: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('CreateAreaUseCase', () => {
  let useCase: CreateAreaUseCase

  beforeEach(() => {
    useCase = new CreateAreaUseCase()
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          userId: '',
          name: 'Test Area',
          scope: 'work',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 name 為空', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: '',
          scope: 'work',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 name 太長', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'a'.repeat(51),
          scope: 'work',
        })
      ).rejects.toThrow('Name must be 50 characters or less')
    })

    it('應該拋出錯誤當 scope 為空', async () => {
      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)
      
      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Area',
          scope: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Area 名稱已存在', async () => {
      const existingArea = {
        id: 'area-456',
        user_id: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: null,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(existingArea)

      await expect(
        useCase.execute({
          userId: 'user-123',
          name: 'Test Area',
          scope: 'work',
        })
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('成功情況', () => {
    it('應該成功創建 Area', async () => {
      const mockArea = {
        id: 'area-123',
        user_id: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: 'Test description',
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }

      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.area.create).mockResolvedValue(mockArea)

      const result = await useCase.execute({
        userId: 'user-123',
        name: 'Test Area',
        scope: 'work',
        description: 'Test description',
      })

      expect(result.area).toEqual(mockArea)
      expect(result.message).toBe('Area created successfully')
      expect(prisma.area.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-123',
          name: 'Test Area',
          scope: 'work',
          description: 'Test description',
          is_custom: true,
        }),
      })
    })

    it('應該處理可選的 description', async () => {
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

      vi.mocked(prisma.area.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.area.create).mockResolvedValue(mockArea)

      const result = await useCase.execute({
        userId: 'user-123',
        name: 'Test Area',
        scope: 'work',
      })

      expect(result.area.description).toBeNull()
    })
  })
})
