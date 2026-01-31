/**
 * GetTaskByIdUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetTaskByIdUseCase } from '@/application/use-cases/tasks/get-task-by-id'
import { NotFoundException } from '@/lib/api-response'

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

describe('GetTaskByIdUseCase', () => {
  let useCase: GetTaskByIdUseCase

  beforeEach(() => {
    useCase = new GetTaskByIdUseCase(mockRepository as any)
    vi.clearAllMocks()
    mockFindById.mockReset()
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
    it('應該成功返回 Task', async () => {
      const mockTask = {
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

      mockFindById.mockResolvedValue(mockTask)

      const result = await useCase.execute({
        taskId: 'task-123',
        userId: 'user-123',
      })

      expect(result.task).toEqual(mockTask)
      expect(mockFindById).toHaveBeenCalledWith('task-123', 'user-123')
    })

    it('應該驗證用戶權限', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          taskId: 'task-123',
          userId: 'different-user',
        })
      ).rejects.toThrow(NotFoundException)

      expect(mockFindById).toHaveBeenCalledWith('task-123', 'different-user')
    })
  })
})
