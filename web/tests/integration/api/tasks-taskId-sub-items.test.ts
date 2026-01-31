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

import { PUT, POST } from '@/app/api/tasks/[taskId]/sub-items/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  createTestTask,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'
import { prisma } from '@/lib/db'

describe('API /api/tasks/[taskId]/sub-items (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testProductId: string
  let testTaskId: string
  let subItemId1: string
  let subItemId2: string
  let subItemId3: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'subitem-test@example.com',
    })
    testUserId = user.id

    // 創建測試數據結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, {
      name: 'Test Project',
    })
    testProductId = product.id

    // 創建帶有 sub-items 的任務
    subItemId1 = randomUUID()
    subItemId2 = randomUUID()
    subItemId3 = randomUUID()
    const task = await createTestTask(testUserId, testProductId, {
      content: 'Task with Sub-items',
      sub_items: [
        {
          id: subItemId1,
          content: 'First item',
          completed: false,
          created_at: new Date().toISOString(),
          completed_at: null,
          order: 0,
        },
        {
          id: subItemId2,
          content: 'Second item',
          completed: true,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          order: 1,
        },
        {
          id: subItemId3,
          content: 'Third item',
          completed: false,
          created_at: new Date().toISOString(),
          completed_at: null,
          order: 2,
        },
      ],
    })
    testTaskId = task.id
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

  describe('PUT /api/tasks/[taskId]/sub-items', () => {
    it('應該成功重新排序 sub-items', async () => {
      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          sub_item_ids: [subItemId3, subItemId1, subItemId2], // 反轉順序
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.subItems).toHaveLength(3)
      expect(data.subItems[0].id).toBe(subItemId3)
      expect(data.subItems[0].order).toBe(0)
      expect(data.subItems[1].id).toBe(subItemId1)
      expect(data.subItems[1].order).toBe(1)
      expect(data.subItems[2].id).toBe(subItemId2)
      expect(data.subItems[2].order).toBe(2)

      // 驗證資料庫中的更新
      const updatedTask = await prisma.task.findUnique({
        where: { id: testTaskId },
      })
      const subItems = updatedTask?.sub_items as any[]
      expect(subItems[0].id).toBe(subItemId3)
      expect(subItems[1].id).toBe(subItemId1)
      expect(subItems[2].id).toBe(subItemId2)
    })

    it('應該正確計算完成率', async () => {
      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          sub_item_ids: [subItemId1, subItemId2, subItemId3],
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta).toHaveProperty('total', 3)
      expect(data.meta).toHaveProperty('completed', 1) // 只有 subItemId2 completed
      expect(data.meta.completionRate).toBeCloseTo(1/3, 5)
    })

    it('應該過濾掉不存在的 sub-item IDs', async () => {
      const nonExistentId = randomUUID()
      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          sub_item_ids: [subItemId1, nonExistentId, subItemId2],
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subItems).toHaveLength(2) // 只有 2 個有效的
      expect(data.subItems[0].id).toBe(subItemId1)
      expect(data.subItems[1].id).toBe(subItemId2)
    })

    it('應該處理空陣列', async () => {
      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          sub_item_ids: [],
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subItems).toHaveLength(0)
      expect(data.meta.total).toBe(0)
      expect(data.meta.completed).toBe(0)
      expect(data.meta.completionRate).toBe(0)
    })

    it('應該在 sub_item_ids 不是陣列時返回 400', async () => {
      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          sub_item_ids: 'not-an-array',
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toContain("sub_item_ids must be an array")
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentTaskId = randomUUID()
      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          sub_item_ids: [subItemId1, subItemId2],
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: nonExistentTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.message).toBe('Task not found')
    })

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'PUT',
        headers: { authorization: 'Bearer invalid-token' },
        body: {
          sub_item_ids: [subItemId1, subItemId2],
        },
      })

      const response = await PUT(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.message).toBe('Invalid or expired token')
    })
  })

  describe('POST /api/tasks/[taskId]/sub-items', () => {
    it('應該成功新增 sub-item', async () => {
      // 為 POST 測試創建獨立的 task，避免與 PUT 測試的數據干擾
      const postTask = await createTestTask(testUserId, testProductId, {
        content: 'Task for POST test',
        sub_items: [
          {
            id: randomUUID(),
            content: 'Existing item 1',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 0,
          },
          {
            id: randomUUID(),
            content: 'Existing item 2',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 1,
          },
        ],
      })

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: 'New sub-item',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: postTask.id }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.subItem).toHaveProperty('id')
      expect(data.subItem).toHaveProperty('content', 'New sub-item')
      expect(data.subItem).toHaveProperty('completed', false)
      expect(data.subItem).toHaveProperty('order', 2) // 新增在最後 (0, 1, 2)
      expect(data.meta).toHaveProperty('total', 3)
    })

    it('應該自動 trim 空格', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: '  Trimmed content  ',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subItem.content).toBe('Trimmed content')
    })

    it('應該在 content 為空時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: '   ',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toContain("Content")
    })

    it('應該在 content 不是 string 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: 123,
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toContain("Content")
    })

    it('應該在缺少 content 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {},
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toContain("Content")
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentTaskId = randomUUID()
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: 'New sub-item',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: nonExistentTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.message).toBe('Task not found')
    })

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer invalid-token' },
        body: {
          content: 'New sub-item',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.message).toBe('Invalid or expired token')
    })
  })
})
