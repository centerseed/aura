/**
 * UpdateTaskUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateTaskUseCase } from '@/application/use-cases/tasks/update-task'
import { NotFoundException, ValidationException } from '@/lib/api-response'
import { TaskStatus } from '@/domain/value-objects/task-status'

// Mock Repository
const mockFindById = vi.fn()
const mockUpdate = vi.fn()

const mockRepository = {
  create: vi.fn(),
  findById: mockFindById,
  findByUserId: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: mockUpdate,
  softDelete: vi.fn(),
}

describe('UpdateTaskUseCase', () => {
  let useCase: UpdateTaskUseCase

  beforeEach(() => {
    useCase = new UpdateTaskUseCase(mockRepository as any)
    vi.clearAllMocks()
    mockFindById.mockReset()
    mockUpdate.mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 taskId', async () => {
      await expect(
        useCase.execute({
          taskId: '',
          userId: 'user-123',
          content: 'Updated content',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 userId', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: '',
          content: 'Updated content',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供任何更新資料', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
        })
      ).rejects.toThrow('No update data provided')
    })

    it('應該拋出錯誤當 timeConfidence 超出範圍', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          timeConfidence: 1.5,
        })
      ).rejects.toThrow('Time confidence must be between 0 and 1')
    })

    it('應該拋出錯誤當 Task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          content: 'Updated content',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 status 無效', async () => {
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
          status: 'INVALID_STATUS',
        })
      ).rejects.toThrow('Invalid status: INVALID_STATUS')
    })
  })

  describe('成功情況', () => {
    it('應該成功更新 Task 的 content', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Old content',
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

      const updatedTask = {
        ...existingTask,
        content: 'New content',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        content: 'New content',
      })

      expect(result.task.content).toBe('New content')
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          content: 'New content',
        })
      )
    })

    it('應該成功更新 Task 的 status', async () => {
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

      const updatedTask = {
        ...existingTask,
        status: 'ARCHIVE',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        status: 'ARCHIVE',
      })

      expect(result.task.status).toBe('ARCHIVE')
      expect(result.message).toBeDefined()
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          status: TaskStatus.ARCHIVE,
        })
      )
    })

    it('應該成功更新 Task 的 productId 和 topicId', async () => {
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

      const updatedTask = {
        ...existingTask,
        productId: 'product-456',
        topicId: 'topic-789',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        productId: 'product-456',
        topicId: 'topic-789',
      })

      expect(result.task.productId).toBe('product-456')
      expect(result.task.topicId).toBe('topic-789')
    })

    it('應該成功更新 Task 的日期欄位', async () => {
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

      const updatedTask = {
        ...existingTask,
        startDate: new Date('2024-01-01'),
        dueDate: new Date('2024-12-31'),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        startDate: '2024-01-01',
        dueDate: '2024-12-31',
      })

      expect(result.task.startDate).toEqual(new Date('2024-01-01'))
      expect(result.task.dueDate).toEqual(new Date('2024-12-31'))
    })

    it('應該成功更新 Task 的 timeConfidence', async () => {
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

      const updatedTask = {
        ...existingTask,
        timeConfidence: 0.8,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        timeConfidence: 0.8,
      })

      expect(result.task.timeConfidence).toBe(0.8)
    })
  })

  describe('due_date 與 status 連動邏輯', () => {
    it('設定 due_date 且目前是 INBOX → 自動改成 ACTIVE', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'INBOX',
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

      const updatedTask = {
        ...existingTask,
        status: 'ACTIVE',
        dueDate: new Date('2024-12-31'),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        dueDate: '2024-12-31',
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          status: TaskStatus.ACTIVE,
          dueDate: expect.any(Date),
        })
      )
      expect(result.message).toBe('已設定截止日期，狀態自動變更為進行中')
    })

    it('清除 due_date 且目前是 ACTIVE → 自動改回 INBOX', async () => {
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
        dueDate: new Date('2024-12-31'),
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTask = {
        ...existingTask,
        status: 'INBOX',
        dueDate: null,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        dueDate: null,
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          status: TaskStatus.INBOX,
          dueDate: null,
        })
      )
      expect(result.message).toBe('已清除截止日期，狀態自動變更為收件匣')
    })

    it('設定 due_date 但目前是 MAINTAIN → 不改變狀態', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'MAINTAIN',
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

      const updatedTask = {
        ...existingTask,
        dueDate: new Date('2024-12-31'),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        dueDate: '2024-12-31',
      })

      // 不應該更新 status
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({
          status: expect.anything(),
        })
      )
    })

    it('清除 due_date 但目前是 INBOX → 不改變狀態', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'INBOX',
        aiAnalysis: null,
        references: [],
        subItems: [],
        startDate: null,
        dueDate: new Date('2024-12-31'),
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTask = {
        ...existingTask,
        dueDate: null,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        dueDate: null,
      })

      // 不應該更新 status
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({
          status: expect.anything(),
        })
      )
    })

    it('明確指定 status 時，連動邏輯不觸發', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'INBOX',
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

      const updatedTask = {
        ...existingTask,
        status: 'MAINTAIN',
        dueDate: new Date('2024-12-31'),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        dueDate: '2024-12-31',
        status: 'MAINTAIN', // 明確指定 status
      })

      // 應該使用明確指定的 status，而不是自動變成 ACTIVE
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          status: TaskStatus.MAINTAIN,
        })
      )
      // message 應該是狀態轉換的提示，而不是連動邏輯的提示
      expect(result.message).not.toBe('已設定截止日期，狀態自動變更為進行中')
    })
  })
})
