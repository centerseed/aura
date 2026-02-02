/**
 * GetCurrentUserUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetCurrentUserUseCase } from '@/application/use-cases/users/get-current-user'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}))

describe('GetCurrentUserUseCase', () => {
  let useCase: GetCurrentUserUseCase

  beforeEach(() => {
    useCase = new GetCurrentUserUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.user.findFirst).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 firebaseUid', async () => {
      await expect(
        useCase.execute({
          firebaseUid: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當用戶不存在', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          firebaseUid: 'firebase-uid-123',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功返回用戶資訊', async () => {
      const mockUser = {
        id: 'user-123',
        auth_provider_id: 'firebase-uid-123',
        auth_provider: 'google',
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

      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)

      const result = await useCase.execute({
        firebaseUid: 'firebase-uid-123',
      })

      expect(result.user.id).toBe('user-123')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.name).toBe('Test User')
      expect(result.user.displayName).toBe('Test User')
      expect(result.user.auth_provider).toBe('google')
      expect(result.user.areas.length).toBe(1)
      expect(result.user.hasAreas).toBe(true)
    })

    it('應該使用 email 作為 displayName 當沒有 name', async () => {
      const mockUser = {
        id: 'user-123',
        auth_provider_id: 'firebase-uid-123',
        auth_provider: 'google',
        email: 'test@example.com',
        name: null,
        settings: null,
        areas: [],
      }

      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)

      const result = await useCase.execute({
        firebaseUid: 'firebase-uid-123',
      })

      expect(result.user.displayName).toBe('test@example.com')
      expect(result.user.hasAreas).toBe(false)
    })
  })
})
