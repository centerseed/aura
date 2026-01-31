/**
 * AddTaskReferenceUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddTaskReferenceUseCase } from '@/application/use-cases/tasks/add-task-reference'
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

describe('AddTaskReferenceUseCase', () => {
  let useCase: AddTaskReferenceUseCase

  beforeEach(() => {
    useCase = new AddTaskReferenceUseCase(mockRepository as any)
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
          type: 'url',
          content: 'https://example.com',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 type 無效', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          type: 'invalid' as any,
          content: 'test content',
        })
      ).rejects.toThrow("Type must be 'url' or 'note'")
    })

    it('應該拋出錯誤當 content 為空', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          type: 'note',
          content: '   ',
        })
      ).rejects.toThrow('Content is required and cannot be empty')
    })

    it('應該拋出錯誤當 URL 格式無效', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          type: 'url',
          content: 'not-a-valid-url',
        })
      ).rejects.toThrow('Invalid URL format')
    })

    it('應該拋出錯誤當 Task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          type: 'url',
          content: 'https://example.com',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功新增 URL reference', async () => {
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
      vi.mocked(prisma.task.update).mockResolvedValue(existingTask as any)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        type: 'url',
        content: 'https://example.com',
        title: 'Example Site',
      })

      expect(result.reference.type).toBe('url')
      expect(result.reference.content).toBe('https://example.com')
      expect(result.reference.title).toBe('Example Site')
      expect(result.reference.id).toBeDefined()
      expect(result.total).toBe(1)
      expect(result.message).toBe('Reference added successfully')
      expect(prisma.task.update).toHaveBeenCalled()
    })

    it('應該成功新增 note reference', async () => {
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
      vi.mocked(prisma.task.update).mockResolvedValue(existingTask as any)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
        type: 'note',
        content: 'Important note about this task',
      })

      expect(result.reference.type).toBe('note')
      expect(result.reference.content).toBe('Important note about this task')
      expect(result.reference.title).toBeNull()
      expect(result.total).toBe(1)
    })

    it('應該將新 reference 附加到現有 references', async () => {
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
        type: 'url',
        content: 'https://new.com',
      })

      expect(result.total).toBe(2)
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          references: expect.arrayContaining([
            expect.objectContaining({ content: 'https://old.com' }),
            expect.objectContaining({ content: 'https://new.com' }),
          ]),
        }),
      })
    })
  })
})
