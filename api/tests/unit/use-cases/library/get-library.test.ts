/**
 * GetLibraryUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetLibraryUseCase } from '@/application/use-cases/library/get-library'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    area: {
      findMany: vi.fn(),
    },
  },
}))

describe('GetLibraryUseCase', () => {
  let useCase: GetLibraryUseCase

  beforeEach(() => {
    useCase = new GetLibraryUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.area.findMany).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          userId: '',
        })
      ).rejects.toThrow(ValidationException)
    })
  })

  describe('成功情況', () => {
    it('應該成功返回完整的層級結構', async () => {
      const mockAreas = [
        {
          id: 'area-1',
          name: 'Work',
          description: null,
          scope: 'work',
          products: [
            {
              id: 'product-1',
              name: 'Project A',
              description: null,
              status: 'ACTIVE',
              lifecycle: 'FINITE',
              references: [],
              tasks: [
                {
                  id: 'task-1',
                  content: 'Task content',
                  status: 'ACTIVE',
                  ai_analysis: null,
                  sub_items: [],
                  references: [],
                  topic: null,
                  start_date: null,
                  due_date: null,
                  time_confidence: null,
                  inferred_from_milestone: null,
                },
              ],
            },
          ],
        },
      ]

      vi.mocked(prisma.area.findMany).mockResolvedValue(mockAreas as any)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.areas.length).toBe(1)
      expect(result.areas[0].products.length).toBe(1)
      expect(result.areas[0].products[0].tasks.length).toBe(1)
    })

    it('應該返回空結構當沒有資料', async () => {
      vi.mocked(prisma.area.findMany).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.areas).toEqual([])
    })
  })
})
