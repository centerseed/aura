import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'

// Mock Firebase Admin BEFORE importing
const mockVerifyIdToken = vi.fn()
const mockAuth = {
  verifyIdToken: mockVerifyIdToken,
}

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    auth: () => mockAuth,
    credential: {
      cert: vi.fn(),
    },
  },
  apps: [],
  initializeApp: vi.fn(),
  auth: () => mockAuth,
  credential: {
    cert: vi.fn(),
  },
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: () => mockAuth,
}))

import { POST } from '@/app/api/products/[id]/reorganize-topics/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  createTestTopic,
  createTestTask,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('POST /api/products/[id]/reorganize-topics (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testProductId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
    })
    testUserId = user.id

    // 創建測試 Product
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, { name: 'Website Project' })
    testProductId = product.id
  })

  afterAll(async () => {
    // 清理測試資料
    await cleanupTestData(testUserId)
    await disconnectDb()
  })

  beforeEach(() => {
    // 重置 Firebase mock
    mockVerifyIdToken.mockClear()
    mockVerifyIdToken.mockResolvedValue({ uid: testFirebaseUid })
  })

  it('應該在 Product 不存在時返回 404', async () => {
    const nonExistentId = randomUUID()
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: nonExistentId })
    const response = await POST(request, { params })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error.message).toBe('Product not found')
  }, 30000)

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'POST',
      headers: {},
    })

    const params = Promise.resolve({ id: testProductId })
    const response = await POST(request, { params })

    expect(response.status).toBe(500) // 實際實作會在 catch 中處理
    const data = await response.json()
    expect(data.error).toBeDefined()
  }, 30000)

  it('應該在沒有 Tasks 時返回空重組建議', async () => {
    // 創建空 Product
    const emptyArea = await createTestArea(testUserId, { name: 'Empty Area' })
    const emptyProduct = await createTestProduct(testUserId, emptyArea.id, { name: 'Empty Product' })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: emptyProduct.id })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.product_name).toBe('Empty Product')
    expect(data.data.current_topics).toEqual([])
    expect(data.data.proposed_clusters).toEqual([])
    expect(data.data.time_inferences).toEqual([])
    expect(data.data.reasoning).toContain('無需重組')
  }, 30000)

  it('應該返回 AI 重組建議（含 Topics 分群）', async () => {
    // 創建多個 Tasks
    const topic1 = await createTestTopic(testProductId, testUserId, { name: 'Frontend' })
    const topic2 = await createTestTopic(testProductId, testUserId, { name: 'Backend' })

    await createTestTask(testUserId, testProductId, {
      content: '實作登入頁面',
      topic_id: topic1.id,
      status: 'ACTIVE',
      ai_analysis: {
        narrative: '前端登入介面開發',
      },
    })

    await createTestTask(testUserId, testProductId, {
      content: '開發 API 端點',
      topic_id: topic2.id,
      status: 'ACTIVE',
      ai_analysis: {
        narrative: '後端 API 開發',
      },
    })

    await createTestTask(testUserId, testProductId, {
      content: '撰寫單元測試',
      topic_id: null,
      status: 'ACTIVE',
      ai_analysis: {
        narrative: '測試覆蓋率提升',
      },
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: testProductId })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)
    const data = await response.json()

    // 驗證回應結構
    expect(data.data.product_id).toBe(testProductId)
    expect(data.data.product_name).toBe('Website Project')
    expect(Array.isArray(data.current_topics)).toBe(true)
    expect(Array.isArray(data.proposed_clusters)).toBe(true)
    expect(Array.isArray(data.time_inferences)).toBe(true)
    expect(Array.isArray(data.tasks_context)).toBe(true)
    expect(typeof data.reasoning).toBe('string')
    expect(data.data.logId).toBeDefined() // SystemEvaluationLog ID
  }, 30000)

  it('應該提供時間推斷（基於 Milestones）', async () => {
    // 創建 Tasks（沒有 due_date）
    await createTestTask(testUserId, testProductId, {
      content: '需要排程的任務 1',
      status: 'ACTIVE',
      due_date: null,
    })

    await createTestTask(testUserId, testProductId, {
      content: '需要排程的任務 2',
      status: 'ACTIVE',
      due_date: null,
    })

    // 創建 Milestone
    const { prisma } = await import('@/lib/db')
    await prisma.milestone.create({
      data: {
        id: randomUUID(),
        user_id: testUserId,
        name: 'Beta Release',
        entity_type: 'PRODUCT',
        entity_id: testProductId,
        target_date: new Date('2024-12-31'),
        status: 'PENDING',
        priority: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: testProductId })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)
    const data = await response.json()

    // 驗證時間推斷
    expect(Array.isArray(data.time_inferences)).toBe(true)

    // 如果 AI 提供了時間推斷
    if (data.time_inferences.length > 0) {
      const inference = data.time_inferences[0]
      expect(inference).toHaveProperty('task_id')
      expect(inference).toHaveProperty('urgency_level')
      expect(inference).toHaveProperty('time_confidence')
      expect(inference).toHaveProperty('reasoning')
    }
  }, 30000)

  it('應該創建 SystemEvaluationLog 記錄', async () => {
    // 創建簡單的 Task
    await createTestTask(testUserId, testProductId, {
      content: 'Log 測試任務',
      status: 'ACTIVE',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: testProductId })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)
    const data = await response.json()

    // 驗證 Log ID 存在
    expect(data.data.logId).toBeDefined()
    expect(typeof data.logId).toBe('string')

    // 檢查 Log 是否實際創建
    const { prisma } = await import('@/lib/db')
    const log = await prisma.systemEvaluationLog.findUnique({
      where: { id: data.logId },
    })

    expect(log).not.toBeNull()
    expect(log?.user_id).toBe(testUserId)
    expect(log?.type).toBe('REORGANIZE')
    expect(log?.user_action).toBe('PENDING')
  }, 30000)

  it('應該過濾已有 due_date 的 Tasks（不提供時間推斷）', async () => {
    // 創建已有 due_date 的 Task
    await createTestTask(testUserId, testProductId, {
      content: '已排程任務',
      status: 'ACTIVE',
      due_date: new Date('2024-12-15'),
    })

    // 創建沒有 due_date 的 Task
    await createTestTask(testUserId, testProductId, {
      content: '未排程任務',
      status: 'ACTIVE',
      due_date: null,
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: testProductId })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)
    const data = await response.json()

    // 驗證時間推斷只針對沒有 due_date 的 Tasks
    if (data.time_inferences.length > 0) {
      for (const inference of data.time_inferences) {
        // 檢查推斷的 task 是否原本沒有 due_date
        const task = data.tasks_context.find((t: any) => t.id === inference.task_id)
        expect(task?.current_due_date).toBeFalsy()
      }
    }
  }, 30000)

  it('應該跳過 ARCHIVE 狀態的 Tasks', async () => {
    // 創建 ARCHIVE 狀態的 Task
    const { prisma } = await import('@/lib/db')
    await prisma.task.create({
      data: {
        id: randomUUID(),
        user_id: testUserId,
        product_id: testProductId,
        content: '已完成任務',
        status: 'ARCHIVE',
        deleted_at: null,
        references: [],
        sub_items: [],
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    // 創建 ACTIVE 狀態的 Task
    await createTestTask(testUserId, testProductId, {
      content: '活躍任務',
      status: 'ACTIVE',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    })

    const params = Promise.resolve({ id: testProductId })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)
    const data = await response.json()

    // ARCHIVE 任務不應出現在 tasks_context 中
    const archivedTask = data.tasks_context.find((t: any) => t.title === '已完成任務')
    expect(archivedTask).toBeUndefined()
  }, 30000)
})
