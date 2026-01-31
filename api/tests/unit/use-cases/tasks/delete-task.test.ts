/**
 * DeleteTaskUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteTaskUseCase } from '@/application/use-cases/tasks/delete-task'
import { NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock TaskRepository
const mockFindById = vi.fn()
const mockSoftDelete = vi.fn()

const mockRepository = {
  create: vi.fn(),
  findById: mockFindById,
  findByUserId: vi.fn(),
  update: vi.fn(),
  softDelete: mockSoftDelete,
}

describe('DeleteTaskUseCase', () => {
  let useCase: DeleteTaskUseCase

  beforeEach(() => {
    useCase = new DeleteTaskUseCase(mockRepository as any)
    vi.clearAllMocks()
    mockFindById.mockReset()
    mockSoftDelete.mockReset()
    vi.mocked(prisma.task.findFirst).mockReset()
    vi.mocked(prisma.product.findFirst).mockReset()
    vi.mocked(prisma.product.findUnique).mockReset()
    vi.mocked(prisma.product.update).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當 Task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功軟刪除 Task (沒有 references)', async () => {
      const task = {
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

      mockFindById.mockResolvedValue(task)
      mockSoftDelete.mockResolvedValue(undefined)
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
      })

      expect(result.taskId).toBe('task-123')
      expect(result.referencesMigrated).toBe(0)
      expect(result.message).toBe('Task deleted successfully')
      expect(mockSoftDelete).toHaveBeenCalledWith('task-123', 'user-123')
    })

    it('應該遷移 references 到 Product 並刪除 Task', async () => {
      const task = {
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
            type: 'url',
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

      const product = {
        id: 'product-123',
        user_id: 'user-123',
        area_id: 'area-123',
        name: 'Test Product',
        references: [],
      } as any

      mockFindById.mockResolvedValue(task)
      vi.mocked(prisma.product.findUnique).mockResolvedValue(product)
      vi.mocked(prisma.product.update).mockResolvedValue(product)
      mockSoftDelete.mockResolvedValue(undefined)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
      })

      expect(result.taskId).toBe('task-123')
      expect(result.referencesMigrated).toBe(1)
      expect(result.message).toBe('Task deleted successfully')
      expect(prisma.product.update).toHaveBeenCalled()
    })
  })
})
