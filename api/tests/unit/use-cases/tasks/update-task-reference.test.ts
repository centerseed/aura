/**
 * UpdateTaskReferenceUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateTaskReferenceUseCase } from '@/application/use-cases/tasks/update-task-reference'
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

describe('UpdateTaskReferenceUseCase', () => {
  let useCase: UpdateTaskReferenceUseCase

  beforeEach(() => {
    useCase = new UpdateTaskReferenceUseCase(mockRepository as any)
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
          referenceId: 'ref-123',
          content: 'Updated content',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 referenceId', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          referenceId: '',
          content: 'Updated content',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 content 為空字串', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          referenceId: 'ref-123',
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
          referenceId: 'ref-123',
          content: 'Updated content',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 Reference 不存在', async () => {
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
          referenceId: 'non-existent',
          content: 'Updated content',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當更新 URL reference 但格式無效', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [
          {
            id: 'ref-1',
            type: 'url' as const,
            content: 'https://old.com',
            title: 'Old',
            createdAt: new Date(),
          },
        ],
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
          referenceId: 'ref-1',
          content: 'not-a-valid-url',
        })
      ).rejects.toThrow('Invalid URL format')
    })
  })

  describe('成功情況', () => {
    it('應該成功更新 reference 的 content', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [
          {
            id: 'ref-1',
            type: 'note' as const,
            content: 'Old content',
            title: 'Title',
            createdAt: new Date(),
          },
        ],
        subItems: [],
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
        referenceId: 'ref-1',
        content: 'New content',
      })

      expect(result.reference.content).toBe('New content')
      expect(result.reference.title).toBe('Title')
      expect(result.message).toBe('Reference updated successfully')
      expect(prisma.task.update).toHaveBeenCalled()
    })

    it('應該成功更新 reference 的 title', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [
          {
            id: 'ref-1',
            type: 'url' as const,
            content: 'https://example.com',
            title: 'Old Title',
            createdAt: new Date(),
          },
        ],
        subItems: [],
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
        referenceId: 'ref-1',
        title: 'New Title',
      })

      expect(result.reference.content).toBe('https://example.com')
      expect(result.reference.title).toBe('New Title')
    })

    it('應該成功更新 URL reference', async () => {
      const existingTask = {
        id: 'task-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Test Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [
          {
            id: 'ref-1',
            type: 'url' as const,
            content: 'https://old.com',
            title: 'Old',
            createdAt: new Date(),
          },
        ],
        subItems: [],
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
        referenceId: 'ref-1',
        content: 'https://new.com',
      })

      expect(result.reference.content).toBe('https://new.com')
      expect(result.reference.type).toBe('url')
    })
  })
})
