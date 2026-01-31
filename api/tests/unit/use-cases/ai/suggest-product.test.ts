/**
 * SuggestProductUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuggestProductUseCase } from '@/application/use-cases/ai/suggest-product'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'google-model'),
}))

describe('SuggestProductUseCase', () => {
  let useCase: SuggestProductUseCase

  beforeEach(() => {
    useCase = new SuggestProductUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockReset()
    vi.mocked(prisma.user.findUnique).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
          taskContent: 'Test task',
          areaId: 'area-123',
          areaName: 'Work',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 taskContent', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          taskContent: '',
          areaId: 'area-123',
          areaName: 'Work',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 areaId', async () => {
      await expect(
        useCase.execute({
          userId: 'user-123',
          taskContent: 'Test task',
          areaId: '',
          areaName: 'Work',
        })
      ).rejects.toThrow(ValidationException)
    })
  })

  // 注意:AI 相關測試比較複雜,這裡只測試基本邏輯
  // 實際的 AI 調用會在整合測試中測試
})
