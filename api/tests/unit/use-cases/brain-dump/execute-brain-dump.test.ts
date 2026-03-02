/**
 * ExecuteBrainDumpUseCase 單元測試
 *
 * 🔴 迴歸測試背景：
 *   Brain Dump 在 execute-brain-dump.ts 裡透過 tx.product.create() 自動建立 Product，
 *   但原本沒有呼叫 ensureProductEmbedding()，導致這些 Product 永遠不會出現在
 *   embedding 向量搜尋結果中，使相關 task 對 AI 完全隱形。
 *
 *   修復後必須確保：新建 Product 時一定呼叫 ensureProductEmbedding()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecuteBrainDumpUseCase } from '@/application/use-cases/brain-dump/execute-brain-dump'
import { TEST_UUIDS } from '../../../helpers/test-uuids'

// ============================================================================
// Mocks
// ============================================================================

const mockTx = {
  product: { create: vi.fn() },
  topic: { create: vi.fn() },
  task: { create: vi.fn(), update: vi.fn() },
  subTask: { create: vi.fn(), findMany: vi.fn() },
  systemEvaluationLog: { create: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const mockEnsureProductEmbedding = vi.fn()
const mockEnsureTaskEmbedding = vi.fn()
vi.mock('@/lib/embedding', () => ({
  ensureProductEmbedding: (...args: any[]) => mockEnsureProductEmbedding(...args),
  ensureTaskEmbedding: (...args: any[]) => mockEnsureTaskEmbedding(...args),
}))

const mockMaybeRefreshBlueprint = vi.fn()
vi.mock('@/lib/product-blueprint', () => ({
  maybeRefreshBlueprint: (...args: any[]) => mockMaybeRefreshBlueprint(...args),
}))

import { prisma } from '@/lib/db'

// ============================================================================
// Helpers
// ============================================================================

function buildItem(overrides: Record<string, any> = {}) {
  return {
    title: '測試任務',
    narrative: '測試背景',
    drawer: 'INBOX',
    lifecycle: 'FINITE',
    tag: { area: '個人', product: '新專案', topic: '' },
    strategy_used: 'new_structure',
    reasoning: '新任務',
    ...overrides,
  }
}

const AREA_WITHOUT_PRODUCTS = [{
  id: TEST_UUIDS.AREA_1,
  name: '個人',
  scope: '個人事務',
  products: [],
}]

const AREA_WITH_EXISTING_PRODUCT = [{
  id: TEST_UUIDS.AREA_1,
  name: '個人',
  scope: '個人事務',
  products: [{
    id: TEST_UUIDS.PRODUCT_1,
    name: '新專案',
    tasks: [],
    topics: [],
  }],
}]

const MOCK_PRODUCT = {
  id: TEST_UUIDS.PRODUCT_1,
  name: '新專案',
  user_id: TEST_UUIDS.USER_1,
  area_id: TEST_UUIDS.AREA_1,
  status: 'INBOX',
  lifecycle: 'FINITE',
  description: null,
  display_order: 0,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
}

function buildMockTask(overrides: Record<string, any> = {}) {
  return {
    id: TEST_UUIDS.TASK_1,
    content: '測試任務',
    user_id: TEST_UUIDS.USER_1,
    product_id: TEST_UUIDS.PRODUCT_1,
    topic_id: null,
    status: 'INBOX',
    due_date: null,
    sub_items: [],
    ai_analysis: {},
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ExecuteBrainDumpUseCase', () => {
  let useCase: ExecuteBrainDumpUseCase

  beforeEach(() => {
    useCase = new ExecuteBrainDumpUseCase()
    vi.clearAllMocks()

    vi.mocked(prisma.task.findMany).mockResolvedValue([])
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return await callback(mockTx)
    })
    vi.mocked(prisma.product.findMany).mockResolvedValue([])  // no cross-area match by default
    mockTx.product.create.mockResolvedValue(MOCK_PRODUCT)
    mockTx.task.create.mockResolvedValue(buildMockTask())
    mockTx.systemEvaluationLog.create.mockResolvedValue({})
    mockEnsureProductEmbedding.mockResolvedValue(undefined)
    mockEnsureTaskEmbedding.mockResolvedValue(undefined)
    mockMaybeRefreshBlueprint.mockResolvedValue(undefined)
  })

  describe('🔴 迴歸測試：Brain Dump 自動建立 Product 必須呼叫 ensureProductEmbedding', () => {
    it('建立新 Product 時必須呼叫 ensureProductEmbedding', async () => {
      await useCase.execute({
        userId: TEST_UUIDS.USER_1,
        text: '新任務',
        inputType: 'text',
        result: { action: 'create_new_tasks', items: [buildItem()] },
        milestones: [],
        existingAreas: AREA_WITHOUT_PRODUCTS,
        imageUnderstandingResult: null,
      })

      expect(mockEnsureProductEmbedding).toHaveBeenCalledTimes(1)
      expect(mockEnsureProductEmbedding).toHaveBeenCalledWith(
        TEST_UUIDS.PRODUCT_1,
        '新專案',
        null
      )
    })

    it('重用已存在的 Product 時不應呼叫 ensureProductEmbedding', async () => {
      await useCase.execute({
        userId: TEST_UUIDS.USER_1,
        text: '新任務',
        inputType: 'text',
        result: { action: 'create_new_tasks', items: [buildItem()] },
        milestones: [],
        existingAreas: AREA_WITH_EXISTING_PRODUCT,
        imageUnderstandingResult: null,
      })

      expect(mockEnsureProductEmbedding).not.toHaveBeenCalled()
    })

    it('同批次多個任務屬於同一個新 Product，只呼叫一次 ensureProductEmbedding', async () => {
      mockTx.task.create
        .mockResolvedValueOnce(buildMockTask({ id: TEST_UUIDS.TASK_1, content: '任務1' }))
        .mockResolvedValueOnce(buildMockTask({ id: TEST_UUIDS.TASK_2, content: '任務2' }))

      await useCase.execute({
        userId: TEST_UUIDS.USER_1,
        text: '兩個新任務',
        inputType: 'text',
        result: {
          action: 'create_new_tasks',
          items: [
            buildItem({ title: '任務1' }),
            buildItem({ title: '任務2' }),
          ],
        },
        milestones: [],
        existingAreas: AREA_WITHOUT_PRODUCTS,
        imageUnderstandingResult: null,
      })

      expect(mockTx.product.create).toHaveBeenCalledTimes(1)
      expect(mockEnsureProductEmbedding).toHaveBeenCalledTimes(1)
    })

    it('兩個任務分屬不同新 Product，每個都呼叫一次 ensureProductEmbedding', async () => {
      const MOCK_PRODUCT_2 = { ...MOCK_PRODUCT, id: TEST_UUIDS.PRODUCT_2, name: '另一專案' }
      mockTx.product.create
        .mockResolvedValueOnce(MOCK_PRODUCT)
        .mockResolvedValueOnce(MOCK_PRODUCT_2)
      mockTx.task.create
        .mockResolvedValueOnce(buildMockTask({ id: TEST_UUIDS.TASK_1, content: '任務1', product_id: TEST_UUIDS.PRODUCT_1 }))
        .mockResolvedValueOnce(buildMockTask({ id: TEST_UUIDS.TASK_2, content: '任務2', product_id: TEST_UUIDS.PRODUCT_2 }))

      await useCase.execute({
        userId: TEST_UUIDS.USER_1,
        text: '兩個不同專案',
        inputType: 'text',
        result: {
          action: 'create_new_tasks',
          items: [
            buildItem({ title: '任務1', tag: { area: '個人', product: '新專案', topic: '' } }),
            buildItem({ title: '任務2', tag: { area: '個人', product: '另一專案', topic: '' } }),
          ],
        },
        milestones: [],
        existingAreas: AREA_WITHOUT_PRODUCTS,
        imageUnderstandingResult: null,
      })

      expect(mockTx.product.create).toHaveBeenCalledTimes(2)
      expect(mockEnsureProductEmbedding).toHaveBeenCalledTimes(2)
      expect(mockEnsureProductEmbedding).toHaveBeenCalledWith(TEST_UUIDS.PRODUCT_1, '新專案', null)
      expect(mockEnsureProductEmbedding).toHaveBeenCalledWith(TEST_UUIDS.PRODUCT_2, '另一專案', null)
    })
  })
})
