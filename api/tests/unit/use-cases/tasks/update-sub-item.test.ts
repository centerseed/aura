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
      findUnique: vi.fn(),
    },
    subTask: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dailyPlanItem: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock sub-task-utils
vi.mock('@/infrastructure/repositories/sub-task-utils', () => ({
  getSubTasksMeta: vi.fn(),
}))

import { getSubTasksMeta } from '@/infrastructure/repositories/sub-task-utils'

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

    it('應該拋出錯誤當沒有提供任何更新欄位', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: 'sub-1',
        })
      ).rejects.toThrow('At least one field')
    })

    it('應該允許只提供 dueDate 而不提供 completed/content', async () => {
      mockFindById.mockResolvedValue({ id: 'task-123', due_date: '2026-12-31' })
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1', content: 'Test', completed: false,
        created_at: new Date(), completed_at: null, order: 0,
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        id: 'sub-1', content: 'Test', completed: false,
        created_at: new Date(), completed_at: null, order: 0,
        due_date: new Date('2026-06-15'), start_date: null,
      } as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 0, completionRate: 0 })

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        dueDate: '2026-06-15',
      })

      expect(result.subItem.due_date).toBeDefined()
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
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ sub_items: null } as any)

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

  describe('日期欄位', () => {
    const now = new Date()

    const taskWithDueDate = {
      id: 'task-123',
      userId: 'user-123',
      content: 'Test Task',
      status: 'ACTIVE',
      due_date: '2026-06-30',
    }

    const taskWithoutDueDate = {
      id: 'task-123',
      userId: 'user-123',
      content: 'Test Task',
      status: 'ACTIVE',
    }

    const mockSubTask = {
      id: 'sub-1', content: 'Item', completed: false,
      created_at: now, completed_at: null, order: 0,
    }

    beforeEach(() => {
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue(mockSubTask as any)
      vi.mocked(getSubTasksMeta).mockResolvedValue({ total: 1, completed: 0, completionRate: 0 })
    })

    it('應該成功設定 startDate 和 dueDate', async () => {
      mockFindById.mockResolvedValue(taskWithDueDate)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        ...mockSubTask,
        start_date: new Date('2026-06-01'),
        due_date: new Date('2026-06-15'),
      } as any)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        startDate: '2026-06-01',
        dueDate: '2026-06-15',
      })

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          start_date: expect.any(Date),
          due_date: expect.any(Date),
        }),
      })
      expect(result.subItem.start_date).toContain('2026-06-01')
      expect(result.subItem.due_date).toContain('2026-06-15')
    })

    it('應該成功清除日期（設為 null）', async () => {
      mockFindById.mockResolvedValue(taskWithoutDueDate)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        ...mockSubTask,
        start_date: null,
        due_date: null,
      } as any)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        startDate: null,
        dueDate: null,
      })

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          start_date: null,
          due_date: null,
        }),
      })
      expect(result.subItem.start_date).toBeNull()
      expect(result.subItem.due_date).toBeNull()
    })

    it('應該拒絕 dueDate 晚於 task 的 due_date', async () => {
      mockFindById.mockResolvedValue(taskWithDueDate)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          subItemId: 'sub-1',
          dueDate: '2026-07-15', // 晚於 task 的 2026-06-30
        })
      ).rejects.toThrow('Sub-item due date cannot be later than the task due date')
    })

    it('應該允許 dueDate 等於 task 的 due_date', async () => {
      mockFindById.mockResolvedValue(taskWithDueDate)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        ...mockSubTask,
        due_date: new Date('2026-06-30'),
        start_date: null,
      } as any)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        dueDate: '2026-06-30',
      })

      expect(result.subItem.due_date).toContain('2026-06-30')
    })

    it('應該允許任意 dueDate 當 task 沒有 due_date', async () => {
      mockFindById.mockResolvedValue(taskWithoutDueDate)
      vi.mocked(prisma.subTask.update).mockResolvedValue({
        ...mockSubTask,
        due_date: new Date('2099-12-31'),
        start_date: null,
      } as any)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        subItemId: 'sub-1',
        dueDate: '2099-12-31',
      })

      expect(result.subItem.due_date).toContain('2099-12-31')
    })
  })
})
