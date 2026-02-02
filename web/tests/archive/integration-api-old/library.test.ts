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

import { GET } from '@/app/api/library/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  createTestTask,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('GET /api/library (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string
  let testProductId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'library-test@example.com',
    })
    testUserId = user.id

    // 創建測試數據結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    testAreaId = area.id

    const product = await createTestProduct(testUserId, testAreaId, {
      name: 'Test Project',
      status: 'ACTIVE',
    })
    testProductId = product.id

    // 創建一些測試任務
    await createTestTask(testUserId, testProductId, {
      content: 'Task 1',
      status: 'ACTIVE',
    })

    await createTestTask(testUserId, testProductId, {
      content: 'Task 2',
      status: 'ARCHIVE',
    })
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

  it('應該返回用戶的完整層級結構', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)

    // 驗證 Area 結構
    const area = data[0]
    expect(area).toHaveProperty('id')
    expect(area).toHaveProperty('name')
    expect(area).toHaveProperty('products')
    expect(Array.isArray(area.products)).toBe(true)

    // 驗證 Product 結構
    const product = area.products[0]
    expect(product).toHaveProperty('id')
    expect(product).toHaveProperty('name')
    expect(product).toHaveProperty('status')
    expect(product).toHaveProperty('referenceCount')
    expect(product).toHaveProperty('tasks')
    expect(Array.isArray(product.tasks)).toBe(true)
  })

  it('應該預設排除 ARCHIVE 狀態的任務', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)

    const tasks = data
      .flatMap((area: any) => area.products)
      .flatMap((product: any) => product.tasks)

    // 應該只有一個 Task（Task 1），Task 2 被過濾掉了
    expect(tasks.length).toBe(1)
    expect(tasks.every((task: any) => task.title !== 'Task 2')).toBe(true)
  })

  it('應該在 include_archived=true 時包含 ARCHIVE 任務', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
      url: 'http://localhost/api/library?include_archived=true',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)

    const tasks = data
      .flatMap((area: any) => area.products)
      .flatMap((product: any) => product.tasks)

    // 應該有兩個 Tasks（包含 ARCHIVE 的 Task 2）
    expect(tasks.length).toBe(2)
  })

  it('應該包含 Task 的詳細資訊', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)

    const task = data[0].products[0].tasks[0]
    expect(task).toHaveProperty('id')
    expect(task).toHaveProperty('title')
    expect(task).toHaveProperty('drawer')
    expect(task).toHaveProperty('lifecycle')
    expect(task).toHaveProperty('tag')
    expect(task.tag).toHaveProperty('area')
    expect(task.tag).toHaveProperty('product')
    expect(task.tag).toHaveProperty('topic')
    expect(task).toHaveProperty('sub_items')
    expect(task).toHaveProperty('sub_items_meta')
    expect(task).toHaveProperty('references')
  })

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer invalid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.message).toBe('Invalid or expired token')
  })

  it('應該按照正確的順序排序（Area 按 name，Product 按 display_order）', async () => {
    // 創建額外的 Area 用於測試排序
    await createTestArea(testUserId, { name: 'Aardvark' }) // 字母順序應該在最前
    await createTestArea(testUserId, { name: 'Zebra' })    // 應該在最後

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    // 檢查 Area 是按 name 排序的
    expect(data[0].name).toBe('Aardvark')
  })
})
