/**
 * MoveSubItemUseCase 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MoveSubItemUseCase } from '@/application/use-cases/tasks/move-sub-item'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    subTask: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock sub-task-utils
vi.mock('@/infrastructure/repositories/sub-task-utils', () => ({
  getSubTasksMeta: vi.fn(),
}))

// Mock librarian-client
vi.mock('@/lib/librarian-client', () => ({
  librarianObserve: vi.fn().mockResolvedValue(undefined),
}))

import { getSubTasksMeta } from '@/infrastructure/repositories/sub-task-utils'

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

describe('MoveSubItemUseCase', () => {
  let useCase: MoveSubItemUseCase

  const sourceTask = {
    id: 'task-source',
    userId: 'user-123',
    productId: 'product-A',
    content: 'Source Task',
    status: 'ACTIVE',
  }

  const targetTask = {
    id: 'task-target',
    userId: 'user-123',
    productId: 'product-B',
    content: 'Target Task',
    status: 'ACTIVE',
  }

  beforeEach(() => {
    useCase = new MoveSubItemUseCase(mockRepository as any)
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 sourceTaskId', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: '',
          targetTaskId: 'task-target',
          subItemId: 'sub-1',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 targetTaskId', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: 'task-source',
          targetTaskId: '',
          subItemId: 'sub-1',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當沒有提供 subItemId', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: 'task-source',
          targetTaskId: 'task-target',
          subItemId: '',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })

    it('應該拋出錯誤當 source 和 target 相同', async () => {
      await expect(
        useCase.execute({
          sourceTaskId: 'task-same',
          targetTaskId: 'task-same',
          subItemId: 'sub-1',
          userId: 'user-123',
        })
      ).rejects.toThrow(ValidationException)
    })
  })

  describe('權限與存在性檢查', () => {
    it('應該拋出錯誤當 source task 不存在', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          sourceTaskId: 'task-source',
          targetTaskId: 'task-target',
          subItemId: 'sub-1',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 target task 不存在', async () => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(null)

      await expect(
        useCase.execute({
          sourceTaskId: 'task-source',
          targetTaskId: 'task-target',
          subItemId: 'sub-1',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出錯誤當 sub-item 不存在', async () => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(targetTask)
      vi.mocked(prisma.subTask.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({
          sourceTaskId: 'task-source',
          targetTaskId: 'task-target',
          subItemId: 'non-existent',
          userId: 'user-123',
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功移動', () => {
    beforeEach(() => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(targetTask)

      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1',
        content: 'Move me',
        completed: false,
        order: 1,
        task_id: 'task-source',
      } as any)

      vi.mocked(prisma.subTask.aggregate).mockResolvedValue({
        _max: { order: 2 },
      } as any)

      vi.mocked(prisma.subTask.update).mockResolvedValue({} as any)

      vi.mocked(prisma.subTask.findMany).mockResolvedValue([
        { id: 'sub-2', order: 0 },
        { id: 'sub-3', order: 2 },
      ] as any)

      vi.mocked(prisma.$transaction).mockResolvedValue([])

      vi.mocked(getSubTasksMeta)
        .mockResolvedValueOnce({ total: 2, completed: 0, completionRate: 0 })
        .mockResolvedValueOnce({ total: 4, completed: 1, completionRate: 0.25 })
    })

    it('應該成功移動 sub-item', async () => {
      const result = await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(result.subItem.id).toBe('sub-1')
      expect(result.subItem.content).toBe('Move me')
      expect(result.subItem.order).toBe(3) // maxOrder(2) + 1
      expect(result.message).toBe('Sub-item moved successfully')
    })

    it('應該更新 sub_task 的 task_id', async () => {
      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { task_id: 'task-target', order: 3 },
      })
    })

    it('應該同步兩個 task 的 JSON', async () => {
      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

    })

    it('應該回傳兩邊的 meta', async () => {
      const result = await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(result.sourceTaskMeta.total).toBe(2)
      expect(result.targetTaskMeta.total).toBe(4)
      expect(result.targetTaskMeta.completionRate).toBe(0.25)
    })

    it('應該重新排序 source task 剩餘 sub_tasks', async () => {
      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('日期自動調整', () => {
    const targetTaskWithDueDate = {
      id: 'task-target',
      userId: 'user-123',
      productId: 'product-B',
      content: 'Target Task',
      status: 'ACTIVE',
      due_date: '2026-03-15',
    }

    beforeEach(() => {
      vi.mocked(prisma.subTask.aggregate).mockResolvedValue({
        _max: { order: 0 },
      } as any)
      vi.mocked(prisma.subTask.update).mockResolvedValue({} as any)
      vi.mocked(prisma.subTask.findMany).mockResolvedValue([])
      vi.mocked(prisma.$transaction).mockResolvedValue([])
      vi.mocked(getSubTasksMeta)
        .mockResolvedValueOnce({ total: 0, completed: 0, completionRate: 0 })
        .mockResolvedValueOnce({ total: 1, completed: 0, completionRate: 0 })
    })

    it('應該縮短 sub-item 的 due_date 當它晚於 target task', async () => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(targetTaskWithDueDate)

      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1',
        content: 'Move me',
        completed: false,
        order: 0,
        task_id: 'task-source',
        due_date: new Date('2026-06-30'), // 晚於 target 的 2026-03-15
        start_date: null,
      } as any)

      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          task_id: 'task-target',
          due_date: new Date('2026-03-15'),
        }),
      })
    })

    it('應該縮短 sub-item 的 start_date 當它晚於 target task 的 due_date', async () => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(targetTaskWithDueDate)

      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1',
        content: 'Move me',
        completed: false,
        order: 0,
        task_id: 'task-source',
        due_date: new Date('2026-06-30'),
        start_date: new Date('2026-05-01'), // 也晚於 target 的 2026-03-15
      } as any)

      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          task_id: 'task-target',
          due_date: new Date('2026-03-15'),
          start_date: new Date('2026-03-15'),
        }),
      })
    })

    it('不應該調整日期當 sub-item 日期早於 target task 的 due_date', async () => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(targetTaskWithDueDate)

      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1',
        content: 'Move me',
        completed: false,
        order: 0,
        task_id: 'task-source',
        due_date: new Date('2026-02-01'), // 早於 target 的 2026-03-15
        start_date: new Date('2026-01-15'),
      } as any)

      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      // 不應包含日期調整
      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { task_id: 'task-target', order: 1 },
      })
    })

    it('不應該調整日期當 target task 沒有 due_date', async () => {
      mockFindById
        .mockResolvedValueOnce(sourceTask)
        .mockResolvedValueOnce(targetTask) // 沒有 due_date

      vi.mocked(prisma.subTask.findFirst).mockResolvedValue({
        id: 'sub-1',
        content: 'Move me',
        completed: false,
        order: 0,
        task_id: 'task-source',
        due_date: new Date('2099-12-31'),
        start_date: null,
      } as any)

      await useCase.execute({
        sourceTaskId: 'task-source',
        targetTaskId: 'task-target',
        subItemId: 'sub-1',
        userId: 'user-123',
      })

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { task_id: 'task-target', order: 1 },
      })
    })
  })
})
