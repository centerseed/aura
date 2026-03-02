/**
 * UpdateTaskUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UpdateTaskUseCase } from '@/application/use-cases/tasks/update-task'
import { NotFoundException, ValidationException } from '@/lib/api-response'
import { TaskStatus } from '@/domain/value-objects/task-status'

// Mock Librarian client
vi.mock('@/lib/librarian-client', () => ({
  librarianObserve: vi.fn().mockResolvedValue(undefined),
}))

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
    },
    dailyPlanItem: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    dailyPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    subTask: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    coachBriefing: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
  },
}))

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
      expect(result.message).toBe('已清除截止日期，狀態自動變更為規劃中')
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

  describe('提醒欄位更新', () => {
    it('應該成功更新 Task 的提醒時間 (remindAt)', async () => {
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
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const remindAt = new Date('2024-12-25T09:00:00Z')
      const updatedTask = {
        ...existingTask,
        remindAt,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        remindAt: '2024-12-25T09:00:00Z',
      })

      expect(result.task.remindAt).toEqual(remindAt)
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          remindAt: expect.any(Date),
        })
      )
    })

    it('應該成功更新 Task 的提醒開關 (reminderEnabled)', async () => {
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
        remindAt: new Date(),
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTask = {
        ...existingTask,
        reminderEnabled: true,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        reminderEnabled: true,
      })

      expect(result.task.reminderEnabled).toBe(true)
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          reminderEnabled: true,
        })
      )
    })

    it('應該成功更新 Task 的時區 (reminderTimezone)', async () => {
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
        remindAt: new Date(),
        reminderEnabled: true,
        reminderTimezone: null,
        notificationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTask = {
        ...existingTask,
        reminderTimezone: 'Asia/Taipei',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        reminderTimezone: 'Asia/Taipei',
      })

      expect(result.task.reminderTimezone).toBe('Asia/Taipei')
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          reminderTimezone: 'Asia/Taipei',
        })
      )
    })

    it('應該成功更新 Task 的通知 ID (notificationId)', async () => {
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
        remindAt: new Date(),
        reminderEnabled: true,
        reminderTimezone: 'Asia/Taipei',
        notificationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTask = {
        ...existingTask,
        notificationId: 1001,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        notificationId: 1001,
      })

      expect(result.task.notificationId).toBe(1001)
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          notificationId: 1001,
        })
      )
    })

    it('應該成功清除提醒時間 (設為 null)', async () => {
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
        remindAt: new Date(),
        reminderEnabled: true,
        reminderTimezone: 'Asia/Taipei',
        notificationId: 1001,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTask = {
        ...existingTask,
        remindAt: null,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        remindAt: null,
      })

      expect(result.task.remindAt).toBeNull()
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          remindAt: null,
        })
      )
    })

    it('應該成功同時更新多個提醒欄位', async () => {
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
        remindAt: null,
        reminderEnabled: false,
        reminderTimezone: null,
        notificationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const remindAt = new Date('2024-12-25T09:00:00Z')
      const updatedTask = {
        ...existingTask,
        remindAt,
        reminderEnabled: true,
        reminderTimezone: 'Asia/Taipei',
        notificationId: 1001,
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        remindAt: '2024-12-25T09:00:00Z',
        reminderEnabled: true,
        reminderTimezone: 'Asia/Taipei',
        notificationId: 1001,
      })

      expect(result.task.remindAt).toEqual(remindAt)
      expect(result.task.reminderEnabled).toBe(true)
      expect(result.task.reminderTimezone).toBe('Asia/Taipei')
      expect(result.task.notificationId).toBe(1001)
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          remindAt: expect.any(Date),
          reminderEnabled: true,
          reminderTimezone: 'Asia/Taipei',
          notificationId: 1001,
        })
      )
    })
  })

  describe('date_source 保護機制', () => {
    it('用戶改 start_date → date_source 自動設為 user', async () => {
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
      mockUpdate.mockResolvedValue({ ...existingTask, startDate: new Date('2026-02-18') })

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        startDate: '2026-02-18',
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          dateSource: 'user',
        })
      )
    })

    it('用戶改 due_date → date_source 自動設為 user', async () => {
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

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue({ ...existingTask, dueDate: new Date('2026-12-31'), status: 'ACTIVE' })

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        dueDate: '2026-12-31',
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          dateSource: 'user',
        })
      )
    })

    it('用戶改其他欄位（content）→ date_source 不變', async () => {
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

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue({ ...existingTask, content: 'New content' })

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        content: 'New content',
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({
          dateSource: expect.anything(),
        })
      )
    })
  })

  describe.skip('M3.5 Episodic Memory — 已封存，待重設計', () => {
    // 共用的基本 task 結構（含新欄位）
    const baseTask = {
      id: 'task-123',
      userId: 'user-123',
      productId: 'product-123',
      topicId: null,
      content: 'Test Task',
      aiAnalysis: null,
      references: [],
      subItems: [],
      dueDate: null,
      timeConfidence: null,
      inferredFromMilestone: null,
      estimatedDurationHours: null,
      actualDurationHours: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('ARCHIVE + 有 start_date → 自動計算 actualDurationHours', async () => {
      // 任務 10 小時前開始
      const startDate = new Date(Date.now() - 10 * 60 * 60 * 1000)
      const existingTask = { ...baseTask, status: 'ACTIVE', startDate }
      const updatedTask = { ...existingTask, status: 'ARCHIVE', actualDurationHours: 10.0 }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ARCHIVE' })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.objectContaining({
          status: TaskStatus.ARCHIVE,
          actualDurationHours: expect.any(Number),
        })
      )
      // 驗證計算值在合理範圍內（9.5 ~ 10.5 小時）
      const updateArg = mockUpdate.mock.calls[0][2]
      expect(updateArg.actualDurationHours).toBeGreaterThan(9.5)
      expect(updateArg.actualDurationHours).toBeLessThan(10.5)
    })

    it('ARCHIVE + 沒有 start_date → 不填入 actualDurationHours', async () => {
      const existingTask = { ...baseTask, status: 'ACTIVE', startDate: null }
      const updatedTask = { ...existingTask, status: 'ARCHIVE' }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ARCHIVE' })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({ actualDurationHours: expect.anything() })
      )
    })

    it('ARCHIVE + actualDurationHours 已有值 → 不覆蓋', async () => {
      const startDate = new Date(Date.now() - 5 * 60 * 60 * 1000)
      // 已有值代表之前已由其他流程計算過
      const existingTask = { ...baseTask, status: 'ACTIVE', startDate, actualDurationHours: 99.9 }
      const updatedTask = { ...existingTask, status: 'ARCHIVE' }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ARCHIVE' })

      // 不應傳入 actualDurationHours（因為 !existingTaskData.actualDurationHours 為 false）
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({ actualDurationHours: expect.anything() })
      )
    })

    it('狀態非 ARCHIVE → 不計算 actualDurationHours', async () => {
      const startDate = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const existingTask = { ...baseTask, status: 'INBOX', startDate }
      const updatedTask = { ...existingTask, status: 'ACTIVE' }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ACTIVE' })

      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({ actualDurationHours: expect.anything() })
      )
    })

    it('已是 ARCHIVE 再次 ARCHIVE → 不重複計算', async () => {
      const startDate = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const existingTask = { ...baseTask, status: 'ARCHIVE', startDate, actualDurationHours: null }
      const updatedTask = { ...existingTask }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ARCHIVE' })

      // wasArchived === isNowArchived，不觸發計算
      expect(mockUpdate).toHaveBeenCalledWith(
        'task-123',
        'user-123',
        expect.not.objectContaining({ actualDurationHours: expect.anything() })
      )
    })

    it('ARCHIVE + actualDurationHours=10 → DailyPlanItem.actual_minutes 回填為 600', async () => {
      const { prisma } = await import('@/lib/db')
      const startDate = new Date(Date.now() - 10 * 60 * 60 * 1000)
      const existingTask = { ...baseTask, status: 'ACTIVE', startDate }
      // 模擬 repository 回傳含有 actualDurationHours 的更新後任務
      const updatedTask = { ...existingTask, status: 'ARCHIVE', actualDurationHours: 10.0 }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)
      vi.mocked(prisma.dailyPlanItem.updateMany).mockResolvedValue({ count: 1 })

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ARCHIVE' })

      expect(prisma.dailyPlanItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completed: true,
            actual_minutes: 600,  // 10 * 60
          }),
        })
      )
    })

    it('ARCHIVE + actualDurationHours=null → DailyPlanItem 不設 actual_minutes', async () => {
      const { prisma } = await import('@/lib/db')
      const startDate = new Date(Date.now() - 5 * 60 * 60 * 1000)
      const existingTask = { ...baseTask, status: 'ACTIVE', startDate: null }
      // 沒有 start_date 所以不計算 actualDurationHours
      const updatedTask = { ...existingTask, status: 'ARCHIVE', actualDurationHours: null }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)
      vi.mocked(prisma.dailyPlanItem.updateMany).mockResolvedValue({ count: 1 })

      await useCase.execute({ taskId: 'task-123', userId: 'user-123', status: 'ARCHIVE' })

      const callArg = vi.mocked(prisma.dailyPlanItem.updateMany).mock.calls[0][0]
      expect(callArg?.data).not.toHaveProperty('actual_minutes')
    })
  })

  describe('Librarian 學習整合', () => {
    let librarianObserveMock: any
    let prismaMock: any

    beforeEach(async () => {
      const { librarianObserve } = await import('@/lib/librarian-client')
      const { prisma } = await import('@/lib/db')
      librarianObserveMock = librarianObserve as any
      prismaMock = prisma as any

      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    it('當 productId 變更時，應該推送修正到 Librarian', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'old-product-id',
        topicId: null,
        content: '買牛奶',
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
        productId: 'new-product-id',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      // Mock product name 查詢
      prismaMock.product.findUnique
        .mockResolvedValueOnce({ name: '行政事務' })  // old product
        .mockResolvedValueOnce({ name: '生活雜務' })  // new product

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        productId: 'new-product-id',
      })

      expect(librarianObserveMock).toHaveBeenCalledWith({
        userId: 'user-123',
        taskContent: '買牛奶',
        originalProduct: '行政事務',
        correctedProduct: '生活雜務',
      })
    })

    it('當 topicId 變更時，應該推送修正到 Librarian', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: 'old-topic-id',
        content: '預約牙醫',
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
        topicId: 'new-topic-id',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      // Mock product and topic name 查詢
      prismaMock.product.findUnique.mockResolvedValue({ name: '生活雜務' })
      prismaMock.topic.findUnique
        .mockResolvedValueOnce({ name: '健康' })     // old topic
        .mockResolvedValueOnce({ name: '醫療' })     // new topic

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        topicId: 'new-topic-id',
      })

      expect(librarianObserveMock).toHaveBeenCalledWith({
        userId: 'user-123',
        taskContent: '預約牙醫',
        originalProduct: '生活雜務',
        correctedProduct: '生活雜務',
        originalTopic: '健康',
        correctedTopic: '醫療',
      })
    })

    it('當 productId 未變更時，不應該推送到 Librarian', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: '測試任務',
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
        content: '更新後的任務',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        content: '更新後的任務',
      })

      expect(librarianObserveMock).not.toHaveBeenCalled()
    })

    it('當 product 查詢失敗時，不應該推送到 Librarian', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'old-product-id',
        topicId: null,
        content: '測試任務',
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
        productId: 'new-product-id',
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValue(existingTask)
      mockUpdate.mockResolvedValue(updatedTask)

      // Mock product 查詢失敗（返回 null）
      prismaMock.product.findUnique.mockResolvedValue(null)

      await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        productId: 'new-product-id',
      })

      expect(librarianObserveMock).not.toHaveBeenCalled()
    })
  })
})
