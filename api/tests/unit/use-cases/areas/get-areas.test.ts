/**
 * GetAreasUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetAreasUseCase } from '@/application/use-cases/areas/get-areas'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    area: {
      findMany: vi.fn(),
    },
  },
}))

describe('GetAreasUseCase', () => {
  let useCase: GetAreasUseCase

  beforeEach(() => {
    useCase = new GetAreasUseCase()
    vi.clearAllMocks()
    vi.mocked(prisma.area.findMany).mockReset()
  })

  describe('成功情況', () => {
    it('應該返回用戶的所有 areas', async () => {
      const mockAreas = [
        {
          id: 'area-1',
          user_id: 'user-123',
          name: 'Area 1',
          scope: 'work',
          description: null,
          is_custom: true,
          display_order: 0,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 'area-2',
          user_id: 'user-123',
          name: 'Area 2',
          scope: 'personal',
          description: 'Test',
          is_custom: false,
          display_order: 1,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ]

      vi.mocked(prisma.area.findMany).mockResolvedValue(mockAreas)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.areas).toEqual(mockAreas)
      expect(result.areas.length).toBe(2)
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-123', deleted_at: null },
        orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      })
    })

    it('應該返回空陣列當用戶沒有 areas', async () => {
      vi.mocked(prisma.area.findMany).mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.areas).toEqual([])
      expect(result.areas.length).toBe(0)
    })
  })
})
