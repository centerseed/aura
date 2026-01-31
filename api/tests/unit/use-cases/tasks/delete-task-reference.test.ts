/**
 * DeleteTaskReferenceUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteTaskReferenceUseCase } from '@/application/use-cases/tasks/delete-task-reference'
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

describe('DeleteTaskReferenceUseCase', () => {
  let useCase: DeleteTaskReferenceUseCase

  beforeEach(() => {
    useCase = new DeleteTaskReferenceUseCase(mockRepository as any)
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
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 referenceId', async () => {
      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          referenceId: '',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 Task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
          referenceId: 'ref-123',
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
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功刪除 reference', async () => {
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
            title: 'Example',
            createdAt: new Date(),
          },
          {
            id: 'ref-2',
            type: 'note' as const,
            content: 'Note content',
            title: null,
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
      })

      expect(result.referenceId).toBe('ref-1')
      expect(result.total).toBe(1)
      expect(result.message).toBe('Reference deleted successfully')
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          references: expect.arrayContaining([
            expect.objectContaining({ id: 'ref-2' }),
          ]),
        }),
      })
    })

    it('應該正確更新 total 數量', async () => {
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
            title: 'Example',
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
      })

      expect(result.total).toBe(0)
    })
  })
})
