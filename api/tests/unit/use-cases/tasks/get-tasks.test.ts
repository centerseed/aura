/**
 * GetTasksUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetTasksUseCase } from '@/application/use-cases/tasks/get-tasks'

// Mock Repository
const mockFindMany = vi.fn()
const mockCount = vi.fn()

const mockRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  findMany: mockFindMany,
  count: mockCount,
  update: vi.fn(),
  softDelete: vi.fn(),
}

describe('GetTasksUseCase', () => {
  let useCase: GetTasksUseCase

  beforeEach(() => {
    useCase = new GetTasksUseCase(mockRepository as any)
    vi.clearAllMocks()
    mockFindMany.mockReset()
    mockCount.mockReset()
  })

  describe('成功情況', () => {
    it('應該返回用戶的所有 tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: 'user-123',
          productId: 'product-123',
          topicId: null,
          content: 'Task 1',
          status: 'ACTIVE',
          aiAnalysis: null,
          references: [],
          subItems: [],
          startDate: null,
          dueDate: null,
          timeConfidence: null,
          inferredFromMilestone: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'task-2',
          userId: 'user-123',
          productId: 'product-123',
          topicId: null,
          content: 'Task 2',
          status: 'ACTIVE',
          aiAnalysis: null,
          references: [],
          subItems: [],
          startDate: null,
          dueDate: null,
          timeConfidence: null,
          inferredFromMilestone: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      mockFindMany.mockResolvedValue(mockTasks)
      mockCount.mockResolvedValue(2)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.tasks).toEqual(mockTasks)
      expect(result.meta.total).toBe(2)
      expect(result.meta.filtered).toBe(2)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          includeDeleted: false,
        })
      )
    })

    it('應該根據 status 過濾 tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: 'user-123',
          productId: 'product-123',
          topicId: null,
          content: 'Task 1',
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
        },
      ]

      mockFindMany.mockResolvedValue(mockTasks)
      // 🚀 優化：移除了額外的 count 查詢，total 現在等於 filtered
      mockCount.mockResolvedValue(10)

      const result = await useCase.execute({
        userId: 'user-123',
        status: 'ACTIVE',
      })

      expect(result.tasks.length).toBe(1)
      expect(result.meta.total).toBe(1) // 優化後 total = filtered
      expect(result.meta.filtered).toBe(1)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          status: 'ACTIVE',
          includeDeleted: false,
        })
      )
    })

    it('應該根據 productId 過濾 tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: 'user-123',
          productId: 'product-456',
          topicId: null,
          content: 'Task 1',
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
        },
      ]

      mockFindMany.mockResolvedValue(mockTasks)
      mockCount.mockResolvedValue(5)

      const result = await useCase.execute({
        userId: 'user-123',
        productId: 'product-456',
      })

      expect(result.tasks.length).toBe(1)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          productId: 'product-456',
          includeDeleted: false,
        })
      )
    })

    it('應該返回空陣列當用戶沒有 tasks', async () => {
      mockFindMany.mockResolvedValue([])
      mockCount.mockResolvedValue(0)

      const result = await useCase.execute({ userId: 'user-123' })

      expect(result.tasks).toEqual([])
      expect(result.meta.total).toBe(0)
      expect(result.meta.filtered).toBe(0)
    })

    it('應該正確排序 tasks (過期任務優先)', async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      const mockTasks = [
        {
          id: 'task-1',
          userId: 'user-123',
          productId: 'product-123',
          topicId: null,
          content: 'Future task',
          status: 'ACTIVE',
          aiAnalysis: null,
          references: [],
          subItems: [],
          startDate: null,
          dueDate: tomorrow,
          timeConfidence: null,
          inferredFromMilestone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          userId: 'user-123',
          productId: 'product-123',
          topicId: null,
          content: 'Overdue task',
          status: 'ACTIVE',
          aiAnalysis: null,
          references: [],
          subItems: [],
          startDate: null,
          dueDate: yesterday,
          timeConfidence: null,
          inferredFromMilestone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockFindMany.mockResolvedValue(mockTasks)
      mockCount.mockResolvedValue(2)

      const result = await useCase.execute({ userId: 'user-123' })

      // 過期任務應該排在前面
      expect(result.tasks[0].id).toBe('task-2')
      expect(result.tasks[1].id).toBe('task-1')
    })
  })
})
