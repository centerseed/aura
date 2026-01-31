/**
 * GetUserByIdUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetUserByIdUseCase } from '@/application/use-cases/users/get-user-by-id'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('GetUserByIdUseCase', () => {
  let useCase: GetUserByIdUseCase

  beforeEach(() => {
    useCase = new GetUserByIdUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當用戶不存在', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        useCase.execute({
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功返回用戶資訊', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        settings: null,
        areas: [
          {
            id: 'area-1',
            name: 'Work',
            scope: 'work',
            description: null,
          },
        ],
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await useCase.execute({
        userId: 'user-123',
      })

      expect(result.id).toBe('user-123')
      expect(result.email).toBe('test@example.com')
      expect(result.name).toBe('Test User')
      expect(result.displayName).toBe('Test User')
      expect(result.areas.length).toBe(1)
      expect(result.hasAreas).toBe(true)
    })
  })
})
