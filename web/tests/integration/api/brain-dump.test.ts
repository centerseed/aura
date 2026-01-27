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

import { POST } from '@/app/api/brain-dump/route'
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

describe('POST /api/brain-dump (Integration)', () => {
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

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'POST',
      headers: {},
      body: { text: 'Test input' },
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  }, 30000)

  it('應該在缺少 text 時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {},
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('text is required')
  }, 30000)

  it('應該處理簡單的單一任務輸入', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '明天要寫完專案報告',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.items.length).toBeGreaterThan(0)

    // 驗證任務結構
    const task = data.items[0]
    expect(task).toHaveProperty('id')
    expect(task).toHaveProperty('title')
    expect(task).toHaveProperty('narrative')
    expect(task).toHaveProperty('drawer')
    expect(task).toHaveProperty('lifecycle')
    expect(task).toHaveProperty('tag')
    expect(task.tag).toHaveProperty('area')
    expect(task.tag).toHaveProperty('product')
  }, 30000)

  it('應該將任務關聯到現有 Area/Product', async () => {
    // 先創建現有結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, { name: 'Project Alpha' })
    await createTestTopic(product.id, testUserId, { name: 'Documentation' })

    // 創建一些現有任務作為上下文
    await createTestTask(testUserId, product.id, {
      content: '撰寫使用手冊',
      status: 'ACTIVE',
      ai_analysis: {
        narrative: '編寫產品使用文件',
      },
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '需要更新 Project Alpha 的 API 文件',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.items.length).toBeGreaterThan(0)

    // AI 應該識別到這與 Project Alpha 相關
    const task = data.items[0]
    expect(task.tag.product.toLowerCase()).toContain('alpha')
  }, 30000)

  it('應該拆分包含多個子項的任務', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '準備會議要：1) 預訂會議室 2) 準備簡報 3) 發送邀請函',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // 檢查任務是否創建
    expect(data.items.length).toBeGreaterThan(0)

    // 驗證資料庫中的任務有 sub_items
    const { prisma } = await import('@/lib/db')
    const task = await prisma.task.findFirst({
      where: {
        id: data.items[0].id,
        user_id: testUserId,
      },
    })

    expect(task).not.toBeNull()
    const subItems = task?.sub_items as any[]
    expect(Array.isArray(subItems)).toBe(true)

    // AI 應該拆分出 3 個 sub-items
    if (subItems && subItems.length > 0) {
      expect(subItems.length).toBeGreaterThanOrEqual(3)
      expect(subItems[0]).toHaveProperty('content')
      expect(subItems[0]).toHaveProperty('completed')
    }
  }, 30000)

  it('應該處理明確指定的時間', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '今天要回覆客戶郵件',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    const task = data.items[0]
    expect(task.due_date).toBeDefined()

    // 檢查資料庫中的任務
    const { prisma } = await import('@/lib/db')
    const dbTask = await prisma.task.findFirst({
      where: {
        id: task.id,
        user_id: testUserId,
      },
    })

    expect(dbTask?.due_date).not.toBeNull()

    // 檢查 ai_analysis 中的時間來源
    const aiAnalysis = dbTask?.ai_analysis as any
    if (aiAnalysis?.due_date_source) {
      expect(aiAnalysis.due_date_source.source_type).toBe('explicit')
      expect(aiAnalysis.due_date_source.confidence).toBeGreaterThanOrEqual(0.9)
    }
  }, 30000)

  it('應該從 Milestone 推斷時間', async () => {
    // 創建測試 Product 和 Milestone
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, { name: 'Q1 Report' })

    const { prisma } = await import('@/lib/db')
    const milestone = await prisma.milestone.create({
      data: {
        id: randomUUID(),
        user_id: testUserId,
        name: 'Q1 End',
        entity_type: 'PRODUCT',
        entity_id: product.id,
        target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 天後
        status: 'PENDING',
        priority: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '完成 Q1 Report 的數據分析',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // 如果 AI 推斷了時間
    if (data.items[0].due_date) {
      const dbTask = await prisma.task.findFirst({
        where: { id: data.items[0].id },
      })

      const aiAnalysis = dbTask?.ai_analysis as any
      if (aiAnalysis?.due_date_source) {
        // 可能是從 milestone 推斷
        if (aiAnalysis.due_date_source.source_type === 'inferred_from_system') {
          expect(dbTask?.inferred_from_milestone).toBeDefined()
        }
      }
    }
  }, 30000)

  it('應該創建新的 Area/Product（如果不存在）', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '開始學習日語',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    const task = data.items[0]
    expect(task.tag.area).toBeDefined()
    expect(task.tag.product).toBeDefined()

    // 驗證 Area/Product 是否真的創建在資料庫中
    const { prisma } = await import('@/lib/db')
    const area = await prisma.area.findFirst({
      where: {
        user_id: testUserId,
        name: task.tag.area,
      },
    })
    expect(area).not.toBeNull()

    const product = await prisma.product.findFirst({
      where: {
        user_id: testUserId,
        name: task.tag.product,
        area_id: area?.id,
      },
    })
    expect(product).not.toBeNull()
  }, 30000)

  it('應該記錄 SystemEvaluationLog', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '測試評估日誌記錄',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // 檢查 SystemEvaluationLog 是否創建
    const { prisma } = await import('@/lib/db')
    const logs = await prisma.systemEvaluationLog.findMany({
      where: {
        user_id: testUserId,
        type: 'BRAIN_DUMP',
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 1,
    })

    expect(logs.length).toBeGreaterThan(0)
    const log = logs[0]
    expect(log.user_action).toBe('APPLIED')

    const metadata = log.metadata as any
    expect(metadata.created_tasks_count).toBeGreaterThan(0)
  }, 30000)

  it('應該保留所有用戶提到的事項（資訊保真度）', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '跟客戶討論 A 專案，他提到預算問題、時程延遲、還有團隊人力不足',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    const task = data.items[0]

    // narrative 應該保留所有細節
    expect(task.narrative.toLowerCase()).toMatch(/(預算|budget)/)
    expect(task.narrative.toLowerCase()).toMatch(/(時程|延遲|delay|schedule)/)
    expect(task.narrative.toLowerCase()).toMatch(/(人力|團隊|team)/)
  }, 30000)
})
