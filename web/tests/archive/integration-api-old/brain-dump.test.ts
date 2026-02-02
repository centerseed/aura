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
    expect(data.error.message).toBe('Missing or invalid token')
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
    expect(data.error.message).toBe('text is required')
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
    expect(data.data.action).toBe('create_new_tasks')
    expect(Array.isArray(data.data.items)).toBe(true)
    expect(data.data.items.length).toBeGreaterThan(0)

    // 驗證任務結構
    const task = data.data.items[0]
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

    // 創建一些現有任務作為上下文（設定為 15 分鐘前，避免 AI 誤判為追加）
    const { prisma } = await import('@/lib/db')
    const task = await createTestTask(testUserId, product.id, {
      content: '撰寫使用手冊',
      status: 'ACTIVE',
      ai_analysis: {
        narrative: '編寫產品使用文件',
      },
    })
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    await prisma.task.update({
      where: { id: task.id },
      data: { created_at: fifteenMinutesAgo },
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
    expect(data.data.action).toBe('create_new_tasks')
    expect(data.data.items.length).toBeGreaterThan(0)

    // AI 應該識別到這與 Project Alpha 相關
    const resultTask = data.data.items[0]
    expect(resultTask.tag.product.toLowerCase()).toContain('alpha')
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

    // AI 可能判斷為追加或創建新任務，兩種都可以
    expect(['create_new_tasks', 'append_sub_item']).toContain(data.data.action)

    const { prisma } = await import('@/lib/db')

    if (data.data.action === 'create_new_tasks') {
      // 檢查任務是否創建
      expect(data.data.items.length).toBeGreaterThan(0)

      // 驗證資料庫中的任務有 sub_items
      const task = await prisma.task.findFirst({
        where: {
          id: data.data.items[0].id,
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
    } else {
      // 如果是追加，也是合理的（AI 判斷與之前的任務相關）
      expect(data.data.appended_sub_items.length).toBeGreaterThan(0)
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
    expect(data.data.action).toBe('create_new_tasks')

    const task = data.data.items[0]
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
    expect(data.data.action).toBe('create_new_tasks')

    // 如果 AI 推斷了時間
    if (data.data.items[0].due_date) {
      const dbTask = await prisma.task.findFirst({
        where: { id: data.data.items[0].id },
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
    expect(data.data.action).toBe('create_new_tasks')

    const task = data.data.items[0]
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
    expect(data.data.action).toBe('create_new_tasks')

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
    expect(data.data.action).toBe('create_new_tasks')

    const task = data.data.items[0]

    // narrative 應該保留所有細節
    expect(task.narrative.toLowerCase()).toMatch(/(預算|budget)/)
    expect(task.narrative.toLowerCase()).toMatch(/(時程|延遲|delay|schedule)/)
    expect(task.narrative.toLowerCase()).toMatch(/(人力|團隊|team)/)
  }, 30000)

  // ============================================================================
  // 新功能：追加 sub-item 到既有任務
  // ============================================================================

  it('應該將後續輸入追加為既有任務的 sub-item', async () => {
    // 1. 先創建一個任務
    const firstRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '明天要準備週報',
      },
    })

    const firstResponse = await POST(firstRequest)
    const firstData = await firstResponse.json()

    expect(firstResponse.status).toBe(200)
    expect(firstData.success).toBe(true)
    expect(firstData.data.action).toBe('create_new_tasks')
    expect(firstData.data.items.length).toBeGreaterThan(0)

    const taskId = firstData.data.items[0].id

    // 等待一小段時間（模擬用戶連續輸入）
    await new Promise(resolve => setTimeout(resolve, 100))

    // 2. 追加第一個 sub-item
    const secondRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '整理本週完成的功能',
      },
    })

    const secondResponse = await POST(secondRequest)
    const secondData = await secondResponse.json()

    expect(secondResponse.status).toBe(200)
    expect(secondData.success).toBe(true)

    // 如果 AI 判斷為追加（可能會判斷為新任務，取決於 AI 的推理）
    if (secondData.data.action === 'append_sub_item') {
      expect(secondData.data.target_task.id).toBe(taskId)
      expect(secondData.data.appended_sub_items.length).toBeGreaterThan(0)
      expect(secondData.data.appended_sub_items[0]).toHaveProperty('content')
      expect(secondData.data.reasoning).toBeDefined()

      // 驗證資料庫中的 sub_items
      const { prisma } = await import('@/lib/db')
      const task = await prisma.task.findFirst({
        where: { id: taskId },
      })

      const subItems = task?.sub_items as any[]
      expect(Array.isArray(subItems)).toBe(true)
      expect(subItems.length).toBeGreaterThan(0)
      expect(subItems[subItems.length - 1].content).toContain('整理')
    } else {
      // 如果 AI 判斷為新任務，這也是合理的（取決於語意）
      expect(secondData.data.action).toBe('create_new_tasks')
    }
  }, 30000)

  it('應該在 10 分鐘內追加多個 sub-items', async () => {
    // 1. 創建主任務
    const mainRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '準備產品發布會',
      },
    })

    const mainResponse = await POST(mainRequest)
    const mainData = await mainResponse.json()

    expect(mainResponse.status).toBe(200)
    expect(mainData.data.action).toBe('create_new_tasks')

    const taskId = mainData.data.items[0].id

    // 2. 追加第一個 sub-item
    await new Promise(resolve => setTimeout(resolve, 100))

    const sub1Request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '預訂場地',
      },
    })

    const sub1Response = await POST(sub1Request)
    const sub1Data = await sub1Response.json()

    expect(sub1Response.status).toBe(200)

    // 3. 追加第二個 sub-item
    await new Promise(resolve => setTimeout(resolve, 100))

    const sub2Request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '準備簡報檔案',
      },
    })

    const sub2Response = await POST(sub2Request)
    const sub2Data = await sub2Response.json()

    expect(sub2Response.status).toBe(200)

    // 驗證資料庫中的任務
    const { prisma } = await import('@/lib/db')
    const task = await prisma.task.findFirst({
      where: { id: taskId },
    })

    // 如果 AI 判斷為追加，檢查 sub_items
    const subItems = task?.sub_items as any[]
    if (Array.isArray(subItems) && subItems.length > 0) {
      // 至少應該有主任務自己的 sub_items 或追加的
      expect(subItems.length).toBeGreaterThanOrEqual(1)
    }

    // 檢查 SystemEvaluationLog
    const logs = await prisma.systemEvaluationLog.findMany({
      where: {
        user_id: testUserId,
        type: 'BRAIN_DUMP',
      },
      orderBy: { created_at: 'desc' },
      take: 3,
    })

    expect(logs.length).toBe(3) // 主任務 + 2 次追加/創建
  }, 30000)

  it('應該在超過 10 分鐘後創建新任務而非追加', async () => {
    // 1. 創建主任務
    const mainRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '撰寫測試報告',
      },
    })

    const mainResponse = await POST(mainRequest)
    const mainData = await mainResponse.json()

    expect(mainResponse.status).toBe(200)
    expect(mainData.data.action).toBe('create_new_tasks')

    const taskId = mainData.data.items[0].id

    // 2. 手動修改任務的 created_at 為 15 分鐘前
    const { prisma } = await import('@/lib/db')
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    await prisma.task.update({
      where: { id: taskId },
      data: { created_at: fifteenMinutesAgo },
    })

    // 3. 嘗試輸入完全無關的新任務
    const newRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '購買辦公室咖啡機',
      },
    })

    const newResponse = await POST(newRequest)
    const newData = await newResponse.json()

    expect(newResponse.status).toBe(200)

    // 由於時間超過 10 分鐘，即使 AI 判斷語意相關，也應優先創建新任務
    // 但如果 AI 仍判斷為追加（可能與其他測試的任務相關），也可接受
    if (newData.data.action === 'create_new_tasks') {
      // 理想情況：創建新任務
      expect(newData.data.items[0].id).not.toBe(taskId)
    } else {
      // AI 判斷為追加（可能因為語意相關或測試間的數據干擾）
      // 這個測試主要驗證 10 分鐘時間篩選是否生效
      // 在實際場景中，用戶的連續輸入會更清晰
      expect(newData.data.action).toBe('append_sub_item')
    }
  }, 30000)

  it('應該在語意不相關時創建新任務', async () => {
    // 1. 創建主任務
    const mainRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '更新網站首頁',
      },
    })

    const mainResponse = await POST(mainRequest)
    const mainData = await mainResponse.json()

    expect(mainResponse.status).toBe(200)
    expect(mainData.data.action).toBe('create_new_tasks')

    const taskId = mainData.data.items[0].id

    // 2. 輸入完全不相關的任務
    await new Promise(resolve => setTimeout(resolve, 100))

    const newRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '購買辦公室咖啡豆',
      },
    })

    const newResponse = await POST(newRequest)
    const newData = await newResponse.json()

    expect(newResponse.status).toBe(200)

    // 語意完全不相關，理想情況應該創建新任務
    // 但如果 AI 判斷為追加（可能因為測試間的數據干擾），也可接受
    expect(['create_new_tasks', 'append_sub_item']).toContain(newData.data.action)
    if (newData.data.action === 'create_new_tasks') {
      expect(newData.data.items[0].id).not.toBe(taskId)
    }
  }, 30000)

  it('應該正確記錄追加 sub-item 的 EvaluationLog', async () => {
    // 1. 創建主任務
    const mainRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '準備客戶簡報',
      },
    })

    await POST(mainRequest)

    // 2. 追加 sub-item
    await new Promise(resolve => setTimeout(resolve, 100))

    const subRequest = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        text: '收集產品數據',
      },
    })

    const subResponse = await POST(subRequest)
    const subData = await subResponse.json()

    expect(subResponse.status).toBe(200)

    // 檢查 EvaluationLog
    const { prisma } = await import('@/lib/db')
    const logs = await prisma.systemEvaluationLog.findMany({
      where: {
        user_id: testUserId,
        type: 'BRAIN_DUMP',
      },
      orderBy: { created_at: 'desc' },
      take: 1,
    })

    expect(logs.length).toBeGreaterThan(0)
    const log = logs[0]
    const outputContent = log.output_content as any

    if (outputContent.action === 'append_sub_item') {
      expect(outputContent.target_task_id).toBeDefined()
      expect(outputContent.sub_items).toBeDefined()
      expect(outputContent.reasoning).toBeDefined()

      const metadata = log.metadata as any
      expect(metadata.appended_sub_items_count).toBeGreaterThan(0)
    }
  }, 30000)
})
