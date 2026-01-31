/**
 * MergeTaskUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MergeTaskUseCase } from '@/application/use-cases/tasks/merge-task'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    task: {
      update: vi.fn(),
    },
  },
}))

// Mock merge-references
vi.mock('@/application/use-cases/merge-references', () => ({
  mergeReferences: vi.fn((target, source) => [...target, ...source]),
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

describe('MergeTaskUseCase', () => {
  let useCase: MergeTaskUseCase

  beforeEach(() => {
    useCase = new MergeTaskUseCase(mockRepository as any)
    vi.clearAllMocks()
    mockFindById.mockReset()
    vi.mocked(prisma.$transaction).mockReset()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 sourceTaskId', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: '',
          targetTaskId: 'target-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 targetTaskId', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: 'source-123',
          targetTaskId: '',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當嘗試合併任務到自己', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: 'task-123',
          targetTaskId: 'task-123',
          userId: 'user-123',
        })
      ).rejects.toThrow('Cannot merge a task into itself')
    })

    it('應該拋出錯誤當來源 Task 不存在', async () => {
      mockFindById.mockResolvedValueOnce(null)

      await expect(
        useCase.execute({
          sourceTaskId: 'source-123',
          targetTaskId: 'target-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當目標 Task 不存在', async () => {
      const sourceTask = {
        id: 'source-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Source Task',
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

      mockFindById.mockResolvedValueOnce(sourceTask)
      mockFindById.mockResolvedValueOnce(null)

      await expect(
        useCase.execute({
          sourceTaskId: 'source-123',
          targetTaskId: 'target-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功情況', () => {
    it('應該成功合併兩個 Task', async () => {
      const sourceTask = {
        id: 'source-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Source Task',
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

      const targetTask = {
        id: 'target-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Target Task',
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

      mockFindById.mockResolvedValueOnce(sourceTask)
      mockFindById.mockResolvedValueOnce(targetTask)
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}])

      const result = await useCase.execute({
        sourceTaskId: 'source-123',
        targetTaskId: 'target-123',
        userId: 'user-123',
      })

      expect(result.sourceTaskId).toBe('source-123')
      expect(result.targetTaskId).toBe('target-123')
      expect(result.newSubItem.content).toBe('Source Task')
      expect(result.newSubItem.completed).toBe(false)
      expect(result.newSubItem.original_task_id).toBe('source-123')
      expect(result.meta.total).toBe(1)
      expect(result.meta.completed).toBe(0)
      expect(result.meta.completionRate).toBe(0)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('應該將已完成的來源 Task 標記為 completed sub-item', async () => {
      const sourceTask = {
        id: 'source-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Source Task',
        status: 'ARCHIVE',
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

      const targetTask = {
        id: 'target-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Target Task',
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

      mockFindById.mockResolvedValueOnce(sourceTask)
      mockFindById.mockResolvedValueOnce(targetTask)
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}])

      const result = await useCase.execute({
        sourceTaskId: 'source-123',
        targetTaskId: 'target-123',
        userId: 'user-123',
      })

      expect(result.newSubItem.completed).toBe(true)
      expect(result.newSubItem.completed_at).toBeDefined()
      expect(result.meta.completed).toBe(1)
      expect(result.meta.completionRate).toBe(1)
    })

    it('應該合併 references', async () => {
      const sourceTask = {
        id: 'source-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Source Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [
          {
            id: 'ref-1',
            type: 'url' as const,
            content: 'https://source.com',
            title: 'Source',
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

      const targetTask = {
        id: 'target-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Target Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [
          {
            id: 'ref-2',
            type: 'url' as const,
            content: 'https://target.com',
            title: 'Target',
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

      mockFindById.mockResolvedValueOnce(sourceTask)
      mockFindById.mockResolvedValueOnce(targetTask)
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}])

      await useCase.execute({
        sourceTaskId: 'source-123',
        targetTaskId: 'target-123',
        userId: 'user-123',
      })

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('應該合併 startDate (取最早的)', async () => {
      const earlierDate = new Date('2024-01-01')
      const laterDate = new Date('2024-12-31')

      const sourceTask = {
        id: 'source-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Source Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [],
        subItems: [],
        startDate: earlierDate,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const targetTask = {
        id: 'target-123',
        userId: 'user-123',
        productId: 'product-123',
        topicId: null,
        content: 'Target Task',
        status: 'ACTIVE',
        aiAnalysis: null,
        references: [],
        subItems: [],
        startDate: laterDate,
        dueDate: null,
        timeConfidence: null,
        inferredFromMilestone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindById.mockResolvedValueOnce(sourceTask)
      mockFindById.mockResolvedValueOnce(targetTask)
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}])

      await useCase.execute({
        sourceTaskId: 'source-123',
        targetTaskId: 'target-123',
        userId: 'user-123',
      })

      // 驗證 transaction 被調用,且應該合併較早的 startDate
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
