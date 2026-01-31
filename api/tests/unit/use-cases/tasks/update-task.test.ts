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
})
