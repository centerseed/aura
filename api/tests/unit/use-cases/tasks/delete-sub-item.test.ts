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
  },
}))

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
    mockFindById.mockReset()
    vi.mocked(prisma.task.update).mockReset()
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
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [],
        subItems: [],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)

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
    it('應該成功刪除 sub-item', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [],
        subItems: [
          {
            id: 'sub-1',
            content: 'Item 1',
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            order: 0,
          },
          {
            id: 'sub-2',
            content: 'Item 2',
            completed: true,
            createdAt: new Date(),
            completedAt: new Date(),
            order: 1,
          },
        ],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.task.update).mockResolvedValue(existingTask as any)

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
      expect(prisma.task.update).toHaveBeenCalled()
    })

    it('應該重新計算 order', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [],
        subItems: [
          {
            id: 'sub-1',
            content: 'Item 1',
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            order: 0,
          },
          {
            id: 'sub-2',
            content: 'Item 2',
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            order: 1,
          },
          {
            id: 'sub-3',
            content: 'Item 3',
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            order: 2,
          },
        ],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.task.update).mockResolvedValue(existingTask as any)

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-2',
      })

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          sub_items: expect.arrayContaining([
            expect.objectContaining({ id: 'sub-1', order: 0 }),
            expect.objectContaining({ id: 'sub-3', order: 1 }),
          ]),
        }),
      })
    })

    it('應該正確計算 completionRate', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [],
        subItems: [
          {
            id: 'sub-1',
            content: 'Item 1',
            completed: true,
            createdAt: new Date(),
            completedAt: new Date(),
            order: 0,
          },
          {
            id: 'sub-2',
            content: 'Item 2',
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            order: 1,
          },
          {
            id: 'sub-3',
            content: 'Item 3',
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            order: 2,
          },
        ],
        startDate: null,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.task.update).mockResolvedValue(existingTask as any)

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
