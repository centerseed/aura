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

import { PATCH, DELETE } from '@/app/api/tasks/[taskId]/sub-items/[subItemId]/route'
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

describe('API /api/tasks/[taskId]/sub-items/[subItemId] (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testProductId: string
  let testTaskId: string
  let subItemId1: string
  let subItemId2: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'subitem-id-test@example.com',
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
    const task = await createTestTask(testUserId, testProductId, {
      content: 'Task with Sub-items',
      sub_items: [
        {
          id: subItemId1,
          content: 'Sub-item 1',
          completed: false,
          created_at: new Date().toISOString(),
          completed_at: null,
          order: 0,
        },
        {
          id: subItemId2,
          content: 'Sub-item 2',
          completed: true,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          order: 1,
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

  describe('PATCH /api/tasks/[taskId]/sub-items/[subItemId]', () => {
    it('應該成功更新 sub-item 的 completed 狀態', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          completed: true,
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.sub_item).toHaveProperty('completed', true)
      expect(data.sub_item).toHaveProperty('completed_at')
      expect(data.sub_items_meta).toHaveProperty('total', 2)
      expect(data.sub_items_meta).toHaveProperty('completed', 2)
      expect(data).toHaveProperty('task_completed', true)
    })

    it('應該成功更新 sub-item 的 content', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: 'Updated sub-item content',
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.sub_item).toHaveProperty('content', 'Updated sub-item content')
    })

    it('應該同時更新 completed 和 content', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          completed: false,
          content: 'New content',
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId2 }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sub_item).toHaveProperty('completed', false)
      expect(data.sub_item).toHaveProperty('content', 'New content')
      expect(data.sub_item).toHaveProperty('completed_at', null)
    })

    it('應該自動 trim 空格', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: '  Trimmed content  ',
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sub_item.content).toBe('Trimmed content')
    })

    it('應該在未提供 completed 或 content 時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {},
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Either 'completed' or 'content' field is required")
    })

    it('應該在 completed 不是 boolean 時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          completed: 'not-a-boolean',
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'completed' must be boolean")
    })

    it('應該在 content 不是 string 時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: 123,
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'content' must be string")
    })

    it('應該在 content 為空時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: '   ',
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'content' cannot be empty")
    })

    it('應該在 sub-item 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          completed: true,
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: nonExistentId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Sub-item not found')
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentTaskId = randomUUID()
      const request = createMockRequest({
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          completed: true,
        },
      })

      const response = await PATCH(request, {
        params: Promise.resolve({ taskId: nonExistentTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Task not found')
    })
  })

  describe('DELETE /api/tasks/[taskId]/sub-items/[subItemId]', () => {
    it('應該成功刪除 sub-item', async () => {
      // 先創建一個新任務用於刪除測試
      const deleteSubItemId = randomUUID()
      const taskForDelete = await createTestTask(testUserId, testProductId, {
        content: 'Task for delete test',
        sub_items: [
          {
            id: deleteSubItemId,
            content: 'To be deleted',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 0,
          },
          {
            id: randomUUID(),
            content: 'Keep this',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 1,
          },
        ],
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: taskForDelete.id, subItemId: deleteSubItemId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('deleted_sub_item_id', deleteSubItemId)
      expect(data.sub_items_meta).toHaveProperty('total', 1)

      // 驗證資料庫中已刪除
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskForDelete.id },
      })
      const subItems = updatedTask?.sub_items as any[]
      expect(subItems.length).toBe(1)
      expect(subItems.find((item: any) => item.id === deleteSubItemId)).toBeUndefined()
    })

    it('應該重新計算 order', async () => {
      const subItem1Id = randomUUID()
      const subItem2Id = randomUUID()
      const subItem3Id = randomUUID()

      const taskForOrder = await createTestTask(testUserId, testProductId, {
        content: 'Task for order test',
        sub_items: [
          {
            id: subItem1Id,
            content: 'First',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 0,
          },
          {
            id: subItem2Id,
            content: 'Second (to delete)',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 1,
          },
          {
            id: subItem3Id,
            content: 'Third',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 2,
          },
        ],
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      await DELETE(request, {
        params: Promise.resolve({ taskId: taskForOrder.id, subItemId: subItem2Id }),
      })

      // 驗證 order 已重新計算
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskForOrder.id },
      })
      const subItems = updatedTask?.sub_items as any[]
      expect(subItems.length).toBe(2)
      expect(subItems[0].order).toBe(0)
      expect(subItems[1].order).toBe(1)
    })

    it('應該在 sub-item 不存在時返回 404', async () => {
      const nonExistentId = randomUUID()
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: testTaskId, subItemId: nonExistentId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Sub-item not found')
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentTaskId = randomUUID()
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: nonExistentTaskId, subItemId: subItemId1 }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Task not found')
    })
  })
})
