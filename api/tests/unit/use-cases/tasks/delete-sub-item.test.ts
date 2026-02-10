/**
 * DeleteSubItemUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteSubItemUseCase } from '@/application/use-cases/tasks/delete-sub-item'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      update: vi.fn(),
    },
    subTask: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock sub-task-sync
vi.mock('@/infrastructure/repositories/sub-task-sync', () => ({
  syncSubTasksToJson: vi.fn(),
  getSubTasksMeta: vi.fn(),
}))

import { syncSubTasksToJson, getSubTasksMeta } from '@/infrastructure/repositories/sub-task-sync'

// Mock Repository
const mockFindById = vi.fn()

const mockRepository = {
  create: vi.fn(),
  findById: mockFindById,
  findByUserId: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}

describe('DeleteSubItemUseCase', () => {
  let useCase: DeleteSubItemUseCase

  beforeEach(() => {
    useCase = new DeleteSubItemUseCase(mockRepository as any)
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 taskId', async () => {
      await expect(
        useCase.execute({
          taskId: '',
          userId: 'user-123',
          subItemId: 'sub-1',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 subItemId', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: 'sub-1',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 Sub-item 不存在', async () => {
      mockFindById.mockResolvedValue({ id: 'task-123' })
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: 'non-existent',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    const existingTask = {
      id: 'task-123',
      userId: 'user-123',
      productId: 'product-123',
      content: 'Test Task',
      status: 'ACTIVE',
    }

    it('應該成功刪除 sub-item', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1', content: 'Item 1', completed: false, order: 0,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({} as any)
      vi.mocked(prisma.subTask.findMany).mockResolvedValue([
        { id: 'sub-2', content: 'Item 2', completed: true, order: 0 },
      ] as any)
      vi.mocked(prisma.$transaction).mockResolvedValue([])
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 1, completionRate: 1 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
      })

      expect(result.subItemId).toBe('sub-1')
      expect(result.meta.total).toBe(1)
      expect(result.meta.completed).toBe(1)
      expect(result.meta.completionRate).toBe(1)
      expect(result.message).toBe('Sub-item deleted successfully')
      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { deleted_at: expect.any(Date) },
      })
      expect(syncSubTasksToJson).toHaveBeenCalledWith('task-123')
    })

    it('應該重新排序剩餘 sub_tasks', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-2', content: 'Item 2', completed: false, order: 1,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({} as any)
      vi.mocked(prisma.subTask.findMany).mockResolvedValue([
        { id: 'sub-1', order: 0 },
        { id: 'sub-3', order: 2 },
      ] as any)
      vi.mocked(prisma.$transaction).mockResolvedValue([])
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 2, completed: 0, completionRate: 0 })

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-2',
      })

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('應該正確計算 completionRate', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-2', content: 'Item 2', completed: false, order: 1,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({} as any)
      vi.mocked(prisma.subTask.findMany).mockResolvedValue([
        { id: 'sub-1', order: 0 },
        { id: 'sub-3', order: 1 },
      ] as any)
      vi.mocked(prisma.$transaction).mockResolvedValue([])
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 2, completed: 1, completionRate: 0.5 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-2',
      })

      expect(result.meta.total).toBe(2)
      expect(result.meta.completed).toBe(1)
      expect(result.meta.completionRate).toBe(0.5)
    })
  })
})
