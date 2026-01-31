/**
 * SignInUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignInUseCase } from '@/application/use-cases/auth/signin'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('SignInUseCase', () => {
  let useCase: SignInUseCase

  beforeEach(() => {
    useCase = new SignInUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.user.findFirst).mockReset()
    vi.mocked(prisma.user.create).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 provider', async () => {
      await expect(
        useCase.execute({
          provider: '' as any,
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 provider 無效', async () => {
      await expect(
        useCase.execute({
          provider: 'invalid' as any,
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Google 登入時沒有提供 providerId', async () => {
      await expect(
        useCase.execute({
          provider: 'google',
          providerId: '',
        })
      ).rejects.toThrow(ValidationException)
    })
  })

  // 注意:Auth 相關測試比較複雜,涉及多種認證方式
  // 這裡只測試基本的驗證邏輯
  // 實際的認證流程會在整合測試中測試
})
