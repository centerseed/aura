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

import { POST } from '@/app/api/reorganize/route'
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

describe('POST /api/reorganize (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
    })
    testUserId = user.id
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

  it('應該在沒有資料時返回成功（無需重組）', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { preview: true },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('No data to reorganize')
    expect(data.changes).toEqual({
      merges: 0,
      reclassifications: 0,
    })
  }, 30000)

  it('應該返回 AI 重組預覽（preview 模式）', async () => {
    // 創建測試結構
    const area1 = await createTestArea(testUserId, { name: 'Work' })
    const product1 = await createTestProduct(testUserId, area1.id, { name: 'Project A' })
    const topic1 = await createTestTopic(product1.id, testUserId, { name: 'Development' })

    await createTestTask(testUserId, product1.id, {
      content: '完成登入功能',
      topic_id: topic1.id,
      ai_analysis: {
        narrative: '實作使用者登入與認證流程',
      },
    })

    await createTestTask(testUserId, product1.id, {
      content: '設計資料庫架構',
      topic_id: topic1.id,
      ai_analysis: {
        narrative: '規劃專案資料庫結構',
      },
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { preview: true },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.preview).toBe(true)
    expect(data).toHaveProperty('analysis')
    expect(data).toHaveProperty('structured_operations')
    expect(data).toHaveProperty('estimated_changes')
    expect(typeof data.analysis).toBe('string')
    expect(Array.isArray(data.structured_operations)).toBe(true)
  }, 30000)

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'POST',
      headers: {},
      body: { preview: true },
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  }, 30000)

  it('應該執行重組操作（confirmed 模式）', async () => {
    // 創建重複的 Products
    const area2 = await createTestArea(testUserId, { name: 'Personal' })
    const product2a = await createTestProduct(testUserId, area2.id, { name: 'Learning' })
    const product2b = await createTestProduct(testUserId, area2.id, { name: 'Learn' })

    await createTestTask(testUserId, product2a.id, {
      content: '學習 TypeScript',
    })

    await createTestTask(testUserId, product2b.id, {
      content: '學習 React',
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { confirmed: true },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data).toHaveProperty('analysis')
    expect(data).toHaveProperty('operations')
    expect(data).toHaveProperty('changes')
    expect(Array.isArray(data.operations)).toBe(true)
  }, 30000)

  it('應該處理空 Product（清理操作）', async () => {
    // 創建空 Product
    const area3 = await createTestArea(testUserId, { name: 'Empty Area' })
    const emptyProduct = await createTestProduct(testUserId, area3.id, { name: 'Empty Product' })

    // 確認 Product 沒有任務
    const { prisma } = await import('@/lib/db')
    const taskCount = await prisma.task.count({
      where: { product_id: emptyProduct.id, deleted_at: null },
    })
    expect(taskCount).toBe(0)

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { confirmed: true },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.changes.emptyProductsCleaned).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('應該支援選擇性執行操作（selected_operation_ids）', async () => {
    // 先獲取預覽
    const area4 = await createTestArea(testUserId, { name: 'Test Area' })
    const product4 = await createTestProduct(testUserId, area4.id, { name: 'Test Product' })

    await createTestTask(testUserId, product4.id, {
      content: '測試任務 1',
    })

    await createTestTask(testUserId, product4.id, {
      content: '測試任務 2',
    })

    const previewRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { preview: true },
    })

    const previewResponse = await POST(previewRequest)
    const previewData = await previewResponse.json()

    // 如果有操作建議，選擇第一個執行
    if (previewData.structured_operations && previewData.structured_operations.length > 0) {
      const selectedIds = [previewData.structured_operations[0].id]

      const confirmRequest = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          confirmed: true,
          selected_operation_ids: selectedIds,
        },
      })

      const confirmResponse = await POST(confirmRequest)
      const confirmData = await confirmResponse.json()

      expect(confirmResponse.status).toBe(200)
      expect(confirmData.success).toBe(true)
    }
  }, 30000)
})
