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

import { GET, DELETE } from '../../../app/api/tasks/[taskId]/route'
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

describe('Tasks [taskId] API (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string
  let testProductId: string
  let testTaskId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'task-id-test@example.com',
    })
    testUserId = user.id

    // 創建測試數據結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    testAreaId = area.id

    const product = await createTestProduct(testUserId, testAreaId, {
      name: 'Test Project',
    })
    testProductId = product.id

    const task = await createTestTask(testUserId, testProductId, {
      content: 'Test Task',
      status: 'ACTIVE',
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

  describe('GET /api/tasks/[taskId]', () => {
    it('應該返回單一任務的詳細資訊', async () => {
      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveProperty('id', testTaskId)
      expect(json.data).toHaveProperty('title', 'Test Task')
      expect(json.data).toHaveProperty('drawer')
      expect(json.data).toHaveProperty('lifecycle')
      expect(json.data).toHaveProperty('tag')
      expect(json.data.tag).toHaveProperty('area')
      expect(json.data.tag).toHaveProperty('product')
      expect(json.data.tag).toHaveProperty('topic')
      expect(json.data).toHaveProperty('sub_items')
      expect(json.data).toHaveProperty('references')
    })

    it('應該在缺少 taskId 時返回 400', async () => {
      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: '' }) })
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toBeDefined()
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentId = randomUUID()
      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: nonExistentId }) })
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('NOT_FOUND')
    })

    it('應該在任務被軟刪除時返回 404', async () => {
      // 創建一個已刪除的任務
      const deletedTask = await createTestTask(testUserId, testProductId, {
        content: 'Deleted Task',
      })
      await prisma.task.update({
        where: { id: deletedTask.id },
        data: { deleted_at: new Date() },
      })

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: deletedTask.id }) })
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('NOT_FOUND')
    })

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer invalid-token' },
      })

      const response = await GET(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('DELETE /api/tasks/[taskId]', () => {
    it('應該軟刪除任務', async () => {
      const taskToDelete = await createTestTask(testUserId, testProductId, {
        content: 'Task to Delete',
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ taskId: taskToDelete.id }) })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveProperty('message')
      expect(json.data).toHaveProperty('taskId', taskToDelete.id)

      // 驗證任務已被軟刪除
      const deletedTask = await prisma.task.findUnique({
        where: { id: taskToDelete.id },
      })
      expect(deletedTask?.deleted_at).not.toBeNull()
    })

    it('應該將任務的 references 遷移到 product 層級', async () => {
      const taskWithRefs = await createTestTask(testUserId, testProductId, {
        content: 'Task with References',
      })

      // 添加 references 到任務
      await prisma.task.update({
        where: { id: taskWithRefs.id },
        data: {
          references: [
            {
              id: randomUUID(),
              type: 'url',
              content: 'https://example.com',
              title: 'Example Link',
              created_at: new Date().toISOString(),
            },
          ],
        },
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ taskId: taskWithRefs.id }) })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveProperty('referencesMigrated', 1)

      // 驗證 references 已遷移到 product
      const product = await prisma.product.findUnique({
        where: { id: testProductId },
      })
      const productRefs = product?.references as any[]
      expect(productRefs.length).toBeGreaterThan(0)
      expect(productRefs[productRefs.length - 1]).toHaveProperty('originalTaskId', taskWithRefs.id)
    })

    it('應該在缺少 taskId 時返回 400', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ taskId: '' }) })
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toBeDefined()
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentId = randomUUID()
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ taskId: nonExistentId }) })
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('NOT_FOUND')
    })

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer invalid-token' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ taskId: testTaskId }) })
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('UNAUTHORIZED')
    })
  })
})
