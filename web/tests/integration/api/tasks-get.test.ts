import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'

// Mock Firebase Admin BEFORE importing (避免真實 Firebase 呼叫)
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

import { GET } from '@/app/api/tasks/route'
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

describe('GET /api/tasks (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string
  let testProductId: string
  let testTopicId: string

  beforeAll(async () => {
    // 創建測試資料
    testFirebaseUid = 'firebase-test-uid-' + Date.now()
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
    })
    testUserId = user.id

    const area = await createTestArea(testUserId, { name: 'Work' })
    testAreaId = area.id

    const product = await createTestProduct(testUserId, testAreaId, { name: 'Website Redesign' })
    testProductId = product.id

    const topic = await createTestTopic(testProductId, testUserId, { name: 'Documentation' })
    testTopicId = topic.id
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

  it('應該返回用戶的所有任務（格式化）', async () => {
    // 創建測試任務
    await createTestTask(testUserId, testProductId, {
      content: '完成專案文件',
      status: 'ACTIVE',
      topic_id: testTopicId,
      ai_analysis: {
        narrative: '需要撰寫完整的技術文件',
        lifecycle: 'active',
        strategy_used: 'boundary_match',
        reasoning: '基於專案截止日期',
      },
      start_date: new Date('2024-01-01'),
      due_date: new Date('2024-01-31'),
      time_confidence: 0.9,
      inferred_from_milestone: null,
    })

    await createTestTask(testUserId, testProductId, {
      content: '學習 React',
      status: 'INBOX',
      ai_analysis: {
        narrative: '開始學習 React 基礎',
        lifecycle: 'embryo',
      },
    })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(2)

    // 驗證第一個任務的格式化
    const task1 = data.find((t: any) => t.title === '完成專案文件')
    expect(task1).toBeDefined()
    expect(task1).toMatchObject({
      title: '完成專案文件',
      narrative: '需要撰寫完整的技術文件',
      drawer: 'ACTIVE',
      lifecycle: 'active',
      tag: {
        area: 'Work',
        product: 'Website Redesign',
        topic: 'Documentation',
      },
      strategy_used: 'boundary_match',
      reasoning: '基於專案截止日期',
      time_confidence: 0.9,
      inferred_from_milestone: null,
    })

    // 驗證第二個任務（未分類 topic）
    const task2 = data.find((t: any) => t.title === '學習 React')
    expect(task2).toBeDefined()
    expect(task2).toMatchObject({
      title: '學習 React',
      narrative: '開始學習 React 基礎',
      drawer: 'INBOX',
      lifecycle: 'embryo',
      tag: {
        area: 'Work',
        product: 'Website Redesign',
        topic: '未分類',
      },
    })
  })

  it('應該在未認證時返回 401', async () => {
    // 移除 authorization header
    const request = createMockRequest({
      headers: {},
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('應該在 Firebase token 無效時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' },
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('應該過濾已刪除的任務', async () => {
    // 創建一個已刪除的任務
    await createTestTask(testUserId, testProductId, {
      content: '已刪除的任務',
      status: 'INBOX',
    })

    // 手動軟刪除（直接更新資料庫）
    const { prisma } = await import('@/lib/db')
    await prisma.task.updateMany({
      where: {
        user_id: testUserId,
        content: '已刪除的任務',
      },
      data: {
        deleted_at: new Date(),
      },
    })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    // 確認回傳的任務中沒有已刪除的任務
    const deletedTask = data.find((t: any) => t.title === '已刪除的任務')
    expect(deletedTask).toBeUndefined()
  })

  it('應該只返回當前用戶的任務', async () => {
    // 創建另一個用戶和任務
    const otherUser = await createTestUser({
      email: `other-${Date.now()}@example.com`,
      auth_provider_id: `other-firebase-uid-${randomUUID()}`,
    })
    const otherArea = await createTestArea(otherUser.id, { name: 'Other Area' })
    const otherProduct = await createTestProduct(otherUser.id, otherArea.id, { name: 'Other Product' })
    await createTestTask(otherUser.id, otherProduct.id, {
      content: '其他用戶的任務',
    })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    // 確認沒有返回其他用戶的任務
    const otherUserTask = data.find((t: any) => t.title === '其他用戶的任務')
    expect(otherUserTask).toBeUndefined()

    // 清理其他用戶資料
    await cleanupTestData(otherUser.id)
  })

  it('應該處理空的任務列表', async () => {
    // 創建新用戶（沒有任務）
    const emptyFirebaseUid = `empty-firebase-uid-${randomUUID()}`
    const emptyUser = await createTestUser({
      email: `empty-${Date.now()}@example.com`,
      auth_provider_id: emptyFirebaseUid,
    })

    mockVerifyIdToken.mockResolvedValue({ uid: emptyFirebaseUid })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])

    // 清理
    await cleanupTestData(emptyUser.id)
    mockVerifyIdToken.mockResolvedValue({ uid: testFirebaseUid }) // 恢復原始 mock
  })

  it('應該處理沒有 ai_analysis 的任務', async () => {
    await createTestTask(testUserId, testProductId, {
      content: '簡單任務',
      status: 'INBOX',
      ai_analysis: null,
    })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    const simpleTask = data.find((t: any) => t.title === '簡單任務')
    expect(simpleTask).toBeDefined()
    expect(simpleTask).toMatchObject({
      narrative: null,
      lifecycle: 'embryo',
      strategy_used: null,
      reasoning: null,
    })
  })

  it('應該正確轉換日期為 ISO 字串', async () => {
    const testDate = new Date('2024-06-15T10:30:00.000Z')
    await createTestTask(testUserId, testProductId, {
      content: 'Task with dates',
      status: 'ACTIVE',
      start_date: testDate,
      due_date: testDate,
      time_confidence: 0.5,
    })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    const taskWithDates = data.find((t: any) => t.title === 'Task with dates')
    expect(taskWithDates).toBeDefined()
    expect(taskWithDates.start_date).toBe('2024-06-15T10:30:00.000Z')
    expect(taskWithDates.due_date).toBe('2024-06-15T10:30:00.000Z')
  })

  it('應該按創建時間倒序排列', async () => {
    // 創建多個任務（間隔時間確保排序）
    const task1 = await createTestTask(testUserId, testProductId, {
      content: 'First task',
    })
    await new Promise(resolve => setTimeout(resolve, 10))

    const task2 = await createTestTask(testUserId, testProductId, {
      content: 'Second task',
    })
    await new Promise(resolve => setTimeout(resolve, 10))

    const task3 = await createTestTask(testUserId, testProductId, {
      content: 'Third task',
    })

    const request = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    const taskTitles = data.map((t: any) => t.title)
    const thirdIndex = taskTitles.indexOf('Third task')
    const secondIndex = taskTitles.indexOf('Second task')
    const firstIndex = taskTitles.indexOf('First task')

    // 最新的任務應該在最前面
    expect(thirdIndex).toBeLessThan(secondIndex)
    expect(secondIndex).toBeLessThan(firstIndex)
  })
})
