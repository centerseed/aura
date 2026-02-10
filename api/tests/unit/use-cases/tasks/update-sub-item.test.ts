/**
 * UpdateSubItemUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateSubItemUseCase } from '@/application/use-cases/tasks/update-sub-item'
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
      update: vi.fn(),
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

describe('UpdateSubItemUseCase', () => {
  let useCase: UpdateSubItemUseCase

  beforeEach(() => {
    useCase = new UpdateSubItemUseCase(mockRepository as any)
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 taskId', async () => {
      await expect(
        useCase.execute({
          taskId: '',
          userId: 'user-123',
          subItemId: 'sub-1',
          completed: true,
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 subItemId', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: '',
          completed: true,
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當既沒提供 completed 也沒提供 content', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: 'sub-1',
        })
      ).rejects.toThrow('Either completed or content field is required')
    })

    it('應該拋出錯誤當 content 為空白字串', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: 'sub-1',
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
          subItemId: 'sub-1',
          completed: true,
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
          completed: true,
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

    const now = new Date()

    it('應該成功更新 sub-item 的 completed 狀態', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1', content: 'Sub-item 1', completed: false,
        created_at: now, completed_at: null, order: 0,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        id: 'sub-1', content: 'Sub-item 1', completed: true,
        created_at: now, completed_at: now, order: 0,
      } as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 1, completionRate: 1 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        completed: true,
      })

      expect(result.subItem.completed).toBe(true)
      expect(result.subItem.completed_at).toBeDefined()
      expect(result.meta.completed).toBe(1)
      expect(result.meta.completionRate).toBe(1)
      expect(result.taskCompleted).toBe(true)
      expect(result.message).toBe('Sub-item updated successfully')
      expect(syncSubTasksToJson).toHaveBeenCalledWith('task-123')
    })

    it('應該成功更新 sub-item 的 content', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1', content: 'Old content', completed: false,
        created_at: now, completed_at: null, order: 0,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        id: 'sub-1', content: 'New content', completed: false,
        created_at: now, completed_at: null, order: 0,
      } as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 0, completionRate: 0 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        content: 'New content',
      })

      expect(result.subItem.content).toBe('New content')
    })

    it('應該正確計算 taskCompleted 狀態', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-2', content: 'Item 2', completed: false,
        created_at: now, completed_at: null, order: 1,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        id: 'sub-2', content: 'Item 2', completed: true,
        created_at: now, completed_at: now, order: 1,
      } as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 2, completed: 2, completionRate: 1 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-2',
        completed: true,
      })

      expect(result.meta.total).toBe(2)
      expect(result.meta.completed).toBe(2)
      expect(result.meta.completionRate).toBe(1)
      expect(result.taskCompleted).toBe(true)
    })

    it('應該正確處理未完成狀態', async () => {
      mockFindById.mockResolvedValue(existingTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1', content: 'Item 1', completed: true,
        created_at: now, completed_at: now, order: 0,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        id: 'sub-1', content: 'Item 1', completed: false,
        created_at: now, completed_at: null, order: 0,
      } as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 0, completionRate: 0 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        completed: false,
      })

      expect(result.subItem.completed).toBe(false)
      expect(result.subItem.completed_at).toBeNull()
      expect(result.meta.completed).toBe(0)
      expect(result.meta.completionRate).toBe(0)
      expect(result.taskCompleted).toBe(false)
    })
  })
})
