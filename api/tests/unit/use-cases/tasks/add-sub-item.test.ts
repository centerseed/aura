/**
 * AddSubItemUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddSubItemUseCase } from '@/application/use-cases/tasks/add-sub-item'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      update: vi.fn(),
    },
    subTask: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
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

describe('AddSubItemUseCase', () => {
  let useCase: AddSubItemUseCase

  beforeEach(() => {
    useCase = new AddSubItemUseCase(mockRepository as any)
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 taskId', async () => {
      await expect(
        useCase.execute({
          taskId: '',
          userId: 'user-123',
          content: 'Sub-item content',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 content', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          content: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 content 為空白字串', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          content: '   ',
        })
      ).rejects.toThrow('Content cannot be empty')
    })

    it('應該拋出錯誤當 Task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          content: 'Sub-item content',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
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

    it('應該成功新增 sub-item', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.aggregate).mockResolvedValue({ _max: { order: null } } as any)
      vi.mocked(prisma.subTask.create).mockResolvedValue({} as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 0, completionRate: 0 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        content: 'New sub-item',
      })

      expect(result.subItem.content).toBe('New sub-item')
      expect(result.subItem.completed).toBe(false)
      expect(result.subItem.order).toBe(0)
      expect(result.subItem.id).toBeDefined()
      expect(result.meta.total).toBe(1)
      expect(result.meta.completed).toBe(0)
      expect(result.meta.completionRate).toBe(0)
      expect(result.message).toBe('Sub-item added successfully')
      expect(prisma.subTask.create).toHaveBeenCalled()
      expect(syncSubTasksToJson).toHaveBeenCalledWith('task-123')
    })

    it('應該將新 sub-item 附加到現有列表', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.aggregate).mockResolvedValue({ _max: { order: 0 } } as any)
      vi.mocked(prisma.subTask.create).mockResolvedValue({} as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 2, completed: 1, completionRate: 0.5 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        content: 'Second sub-item',
      })

      expect(result.subItem.order).toBe(1)
      expect(result.meta.total).toBe(2)
      expect(result.meta.completed).toBe(1)
      expect(result.meta.completionRate).toBe(0.5)
    })

    it('應該正確計算 completionRate', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.aggregate).mockResolvedValue({ _max: { order: 2 } } as any)
      vi.mocked(prisma.subTask.create).mockResolvedValue({} as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 4, completed: 2, completionRate: 0.5 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        content: 'Item 4',
      })

      expect(result.meta.total).toBe(4)
      expect(result.meta.completed).toBe(2)
      expect(result.meta.completionRate).toBe(0.5)
    })
  })
})
