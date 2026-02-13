/**
 * Scenario A.5: 完成任務後自動追蹤偏差
 *
 * 用戶在 Claude Code 完成工作後，呼叫 report_done，
 * Coach 計算偏差、更新 Episodic Memory。
 *
 * 驗證：
 * 1. report_done 更新任務為完成
 * 2. 計算 estimated vs actual 的偏差
 * 3. 返回 deviation 資料（ratio, updated_bias）
 * 4. 返回 coach_feedback 文字
 * 5. memory/bias resource 反映更新後的偏差數據
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    task: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    dailyPlanItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subTask: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

import { ReportDoneUseCase } from '@/application/use-cases/mcp/report-done'
import { GetMemoryBiasUseCase } from '@/application/use-cases/mcp/get-memory-bias'
import { prisma } from '@/lib/db'

const mockTaskFindFirst = prisma.task.findFirst as any
const mockTransaction = prisma.$transaction as any
const mockQueryRaw = prisma.$queryRaw as any
const mockPlanItemFindFirst = prisma.dailyPlanItem.findFirst as any

describe('Scenario A.5: 完成任務後自動追蹤偏差', () => {
  describe('ReportDoneUseCase', () => {
    let useCase: ReportDoneUseCase

    beforeEach(() => {
      vi.clearAllMocks()
      useCase = new ReportDoneUseCase()
    })

    it('應計算偏差並返回 coach_feedback', async () => {
      // Arrange: task exists with estimated time
      mockTaskFindFirst.mockResolvedValue({
        id: 'task-1',
        user_id: 'user-1',
        content: '重構 auth 模組',
        status: 'ACTIVE',
        product: { name: 'Zentropy', area: { name: 'Work' } },
      })

      // Mock plan item with estimated_minutes
      mockPlanItemFindFirst.mockResolvedValue({
        id: 'item-1',
        task_id: 'task-1',
        estimated_minutes: 240,
        area_name: 'Work',
      })

      // Mock transaction to execute callback with fake tx
      mockTransaction.mockImplementation(async (fn: any) => {
        const fakeTx = {
          task: { update: vi.fn().mockResolvedValue({}) },
          dailyPlanItem: { update: vi.fn().mockResolvedValue({}) },
        }
        return fn(fakeTx)
      })

      // Mock calibration history
      mockQueryRaw.mockResolvedValue([
        { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
        { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
        { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
      ])

      // Act
      const result = await useCase.execute({
        userId: 'user-1',
        actionId: 'task-1',
        actualDurationMinutes: 300,
        outcome: 'completed',
        notes: '比預期複雜',
      })

      // Assert
      expect(result.action_id).toBe('task-1')
      expect(result.status).toBe('completed')
      expect(result.completed_at).toBeDefined()
      expect(result.deviation).toBeDefined()
      expect(result.deviation!.estimated_minutes).toBe(240)
      expect(result.deviation!.actual_minutes).toBe(300)
      expect(result.deviation!.ratio).toBeCloseTo(1.25, 1)
      expect(result.coach_feedback).toBeDefined()
      expect(result.coach_feedback.length).toBeGreaterThan(0)
    })

    it('沒有估時資料時偏差應為 null', async () => {
      mockTaskFindFirst.mockResolvedValue({
        id: 'task-1',
        user_id: 'user-1',
        content: '隨手記',
        status: 'ACTIVE',
        product: { name: 'Zentropy', area: { name: 'Work' } },
      })

      mockPlanItemFindFirst.mockResolvedValue(null)

      // Mock transaction to execute callback with fake tx
      mockTransaction.mockImplementation(async (fn: any) => {
        const fakeTx = {
          task: { update: vi.fn().mockResolvedValue({}) },
          dailyPlanItem: { update: vi.fn().mockResolvedValue({}) },
        }
        return fn(fakeTx)
      })

      mockQueryRaw.mockResolvedValue([])

      const result = await useCase.execute({
        userId: 'user-1',
        actionId: 'task-1',
        outcome: 'completed',
      })

      expect(result.action_id).toBe('task-1')
      expect(result.status).toBe('completed')
      expect(result.deviation).toBeNull()
    })

    it('task 不存在應拋錯', async () => {
      mockTaskFindFirst.mockResolvedValue(null)

      await expect(
        useCase.execute({
          userId: 'user-1',
          actionId: 'nonexistent',
          outcome: 'completed',
        }),
      ).rejects.toThrow()
    })

    it('partial 狀態不應標為完成', async () => {
      mockTaskFindFirst.mockResolvedValue({
        id: 'task-1',
        user_id: 'user-1',
        content: '部分完成',
        status: 'ACTIVE',
        product: { name: 'Zentropy', area: { name: 'Work' } },
      })

      mockPlanItemFindFirst.mockResolvedValue(null)

      // Mock transaction to execute callback (partial: isCompleted=false, planItem=null)
      mockTransaction.mockImplementation(async (fn: any) => {
        const fakeTx = {
          task: { update: vi.fn().mockResolvedValue({}) },
          dailyPlanItem: { update: vi.fn().mockResolvedValue({}) },
        }
        return fn(fakeTx)
      })

      mockQueryRaw.mockResolvedValue([])

      const result = await useCase.execute({
        userId: 'user-1',
        actionId: 'task-1',
        outcome: 'partial',
        notes: '做了一半',
      })

      expect(result.status).toBe('partial')
    })
  })

  describe('GetMemoryBiasUseCase — 偏差數據 Resource', () => {
    let biasUseCase: GetMemoryBiasUseCase

    beforeEach(() => {
      vi.clearAllMocks()
      biasUseCase = new GetMemoryBiasUseCase()
    })

    it('應返回結構化的偏差數據', async () => {
      // Arrange: 有足夠歷史數據
      mockQueryRaw.mockResolvedValue([
        { area_name: 'Work', estimated_minutes: 100, actual_minutes: 210 },
        { area_name: 'Work', estimated_minutes: 100, actual_minutes: 210 },
        { area_name: 'Work', estimated_minutes: 100, actual_minutes: 210 },
        { area_name: 'Personal', estimated_minutes: 100, actual_minutes: 100 },
        { area_name: 'Personal', estimated_minutes: 100, actual_minutes: 100 },
        { area_name: 'Personal', estimated_minutes: 100, actual_minutes: 100 },
      ])

      const result = await biasUseCase.execute({ userId: 'user-1' })

      // Assert: MCP memory/bias 格式
      expect(result.overall_bias_ratio).toBeCloseTo(1.55, 1)
      expect(result.by_area).toBeDefined()
      expect(Object.keys(result.by_area).length).toBeGreaterThanOrEqual(2)

      // Work area 偏差 2.1
      expect(result.by_area['Work']).toBeDefined()
      expect(result.by_area['Work'].bias).toBeCloseTo(2.1, 1)
      expect(result.by_area['Work'].sample_size).toBe(3)

      // Personal area 偏差 1.0
      expect(result.by_area['Personal']).toBeDefined()
      expect(result.by_area['Personal'].bias).toBeCloseTo(1.0, 1)
    })

    it('冷啟動時回傳預設值', async () => {
      mockQueryRaw.mockResolvedValue([])

      const result = await biasUseCase.execute({ userId: 'user-1' })

      expect(result.overall_bias_ratio).toBe(1.0)
      expect(result.by_area).toEqual({})
      expect(result.insight).toContain('insufficient')
    })
  })
})
