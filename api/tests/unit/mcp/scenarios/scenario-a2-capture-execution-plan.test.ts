/**
 * Scenario A.2: Claude Code 拆任務回流到 Zentropy
 *
 * Claude Code 讀取 handoff/ready 後，基於 codebase 拆出子任務，
 * 透過 capture(mode=execution_plan) 回流到 Zentropy。
 *
 * 驗證：
 * 1. capture 接受 mode=execution_plan + parent_id + 結構化 content
 * 2. Gatekeeper 識別為 execution_plan → 建立 sub_items 掛在 parent 下
 * 3. 回應包含 classified_as, filed_to, parent_id, agent_actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    subTask: {
      createMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

import { CaptureUseCase } from '@/application/use-cases/mcp/capture'
import { prisma } from '@/lib/db'

const mockTaskFindFirst = prisma.task.findFirst as any
const mockTransaction = prisma.$transaction as any

describe('Scenario A.2: Claude Code 拆任務回流到 Zentropy', () => {
  let useCase: CaptureUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new CaptureUseCase()
  })

  it('execution_plan 模式應建立子任務掛在 parent 下', async () => {
    // Arrange: parent task 存在
    mockTaskFindFirst.mockResolvedValue({
      id: 'task-1',
      user_id: 'user-1',
      content: '重構 auth 模組',
      product: { name: 'Zentropy', area: { name: 'Work' } },
    })

    // Mock transaction to simulate sub-task creation
    mockTransaction.mockImplementation(async (fn: any) => {
      return {
        createdSubTasks: [
          { id: 'st-1', content: '將 auth.ts middleware 改為 async' },
          { id: 'st-2', content: '更新 3 個依賴的 route handler' },
          { id: 'st-3', content: '修改測試 mock' },
        ],
      }
    })

    const executionPlanContent = JSON.stringify({
      sub_items: [
        { title: '將 auth.ts middleware 改為 async', estimated_minutes: 60 },
        { title: '更新 3 個依賴的 route handler', estimated_minutes: 90 },
        { title: '修改測試 mock', estimated_minutes: 45 },
      ],
      total_estimated_minutes: 195,
      codebase_context: '涉及 auth.ts + 3 個 route files + test/',
    })

    // Act
    const result = await useCase.execute({
      userId: 'user-1',
      content: executionPlanContent,
      source: 'Claude Code',
      mode: 'execution_plan',
      parent_id: 'task-1',
    })

    // Assert
    expect(result.status).toBe('processed')
    expect(result.classified_as).toBe('execution_plan')
    expect(result.parent_id).toBe('task-1')
    expect(result.filed_to).toBeDefined()
    expect(result.filed_to.area).toBe('Work')
    expect(result.filed_to.product).toBe('Zentropy')
    expect(result.agent_actions).toBeDefined()
    expect(result.agent_actions.length).toBeGreaterThan(0)
  })

  it('execution_plan 模式缺少 parent_id 應拋錯', async () => {
    await expect(
      useCase.execute({
        userId: 'user-1',
        content: JSON.stringify({ sub_items: [] }),
        source: 'Claude Code',
        mode: 'execution_plan',
        // 缺少 parent_id
      }),
    ).rejects.toThrow('parent_id is required')
  })

  it('execution_plan 模式的 parent_id 不存在應拋錯', async () => {
    mockTaskFindFirst.mockResolvedValue(null)

    await expect(
      useCase.execute({
        userId: 'user-1',
        content: JSON.stringify({ sub_items: [] }),
        source: 'Claude Code',
        mode: 'execution_plan',
        parent_id: 'nonexistent-task',
      }),
    ).rejects.toThrow('Parent task not found')
  })

  it('result 模式應記錄執行結果', async () => {
    mockTaskFindFirst.mockResolvedValue({
      id: 'task-1',
      user_id: 'user-1',
      content: '重構 auth 模組',
      product: { name: 'Zentropy', area: { name: 'Work' } },
    })

    mockTransaction.mockImplementation(async (fn: any) => {
      return { updated: true }
    })

    const resultContent = JSON.stringify({
      outcome: 'completed',
      actual_duration_minutes: 300,
      notes: '比預期複雜，需要處理 3 個 legacy 相容問題',
      artifacts: ['PR #67 已提交'],
    })

    const result = await useCase.execute({
      userId: 'user-1',
      content: resultContent,
      source: 'Claude Code',
      mode: 'result',
      parent_id: 'task-1',
    })

    expect(result.status).toBe('processed')
    expect(result.classified_as).toBe('result')
    expect(result.parent_id).toBe('task-1')
  })
})
