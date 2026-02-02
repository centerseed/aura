/**
 * CreateTaskUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateTaskUseCase } from '@/application/use-cases/tasks/create-task'
import { ValidationException } from '@/lib/api-response'
import { TaskStatus } from '@/domain/value-objects/task-status'
import { VALID_USER_ID, VALID_PRODUCT_ID, VALID_TOPIC_ID, VALID_TASK_ID } from '../../../helpers/test-uuids'

// Mock TaskRepository
const mockCreate = vi.fn()

const mockRepository = {
  create: mockCreate,
  findById: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('CreateTaskUseCase', () => {
  let useCase: CreateTaskUseCase

  beforeEach(() => {
    useCase = new CreateTaskUseCase(mockRepository as any)
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 userId 為空', async () => {
      await expect(
        useCase.execute({
          userId: '',
          productId: VALID_PRODUCT_ID,
          content: 'Test Task',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 productId 為空', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: '',
          content: 'Test Task',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 productId 格式無效', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: 'invalid-uuid',
          content: 'Test Task',
        })
      ).rejects.toThrow('Invalid Product ID format')
    })

    it('應該拋出錯誤當 content 為空', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: VALID_PRODUCT_ID,
          content: '',
        })
      ).rejects.toThrow('Task content cannot be empty')
    })

    it('應該拋出錯誤當 content 超過 500 字元', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: VALID_PRODUCT_ID,
          content: 'a'.repeat(501),
        })
      ).rejects.toThrow('Task content must be less than 500 characters')
    })

    it('應該拋出錯誤當 timeConfidence 不在 0-1 之間', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: VALID_PRODUCT_ID,
          content: 'Test Task',
          timeConfidence: 1.5,
        })
      ).rejects.toThrow('Time confidence must be between 0 and 1')
    })

    it('應該拋出錯誤當 status 無效', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: VALID_PRODUCT_ID,
          content: 'Test Task',
          status: 'INVALID_STATUS',
        })
      ).rejects.toThrow('Invalid status')
    })

    it('應該拋出錯誤當截止日期早於開始日期', async () => {
      await expect(
        useCase.execute({
          userId: VALID_USER_ID,
          productId: VALID_PRODUCT_ID,
          content: 'Test Task',
          startDate: '2024-12-31',
          dueDate: '2024-01-01',
        })
      ).rejects.toThrow('Due date cannot be earlier than start date')
    })
  })

  describe('成功情況', () => {
    it('應該成功創建任務 (預設 INBOX 狀態)', async () => {
      const mockTask = {
        id: VALID_TASK_ID,
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        topicId: null,
        content: 'Test Task',
        status: TaskStatus.INBOX,
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

      mockCreate.mockResolvedValue(mockTask)

      const result = await useCase.execute({
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        content: 'Test Task',
      })

      expect(result.task).toEqual(mockTask)
      expect(result.message).toContain('Task created successfully')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: VALID_USER_ID,
          productId: VALID_PRODUCT_ID,
          content: 'Test Task',
          status: TaskStatus.INBOX,
        })
      )
    })

    it('應該成功創建任務 (指定 ACTIVE 狀態)', async () => {
      const mockTask = {
        id: VALID_TASK_ID,
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        topicId: null,
        content: 'Test Task',
        status: TaskStatus.ACTIVE,
        aiAnalysis: null,
        references: [],
        subItems: [],
        startDate: null,
        dueDate: new Date('2024-12-31'),
        timeConfidence: 0.8,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCreate.mockResolvedValue(mockTask)

      const result = await useCase.execute({
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        content: 'Test Task',
        status: 'ACTIVE',
        dueDate: '2024-12-31',
        timeConfidence: 0.8,
      })

      expect(result.task.status).toBe(TaskStatus.ACTIVE)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.ACTIVE,
          timeConfidence: 0.8,
        })
      )
    })

    it('應該處理可選的 topicId', async () => {
      const mockTask = {
        id: VALID_TASK_ID,
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        topicId: VALID_TOPIC_ID,
        content: 'Test Task',
        status: TaskStatus.INBOX,
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

      mockCreate.mockResolvedValue(mockTask)

      const result = await useCase.execute({
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        topicId: VALID_TOPIC_ID,
        content: 'Test Task',
      })

      expect(result.task.topicId).toBe(VALID_TOPIC_ID)
    })

    it('應該正確處理日期字串轉換', async () => {
      const startDate = '2024-01-01'
      const dueDate = '2024-12-31'

      const mockTask = {
        id: VALID_TASK_ID,
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        topicId: null,
        content: 'Test Task',
        status: TaskStatus.ACTIVE,
        aiAnalysis: null,
        references: [],
        subItems: [],
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCreate.mockResolvedValue(mockTask)

      await useCase.execute({
        userId: VALID_USER_ID,
        productId: VALID_PRODUCT_ID,
        content: 'Test Task',
        startDate,
        dueDate,
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: new Date(startDate),
          dueDate: new Date(dueDate),
        })
      )
    })
  })
})
