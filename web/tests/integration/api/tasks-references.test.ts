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

import { POST, DELETE } from '@/app/api/tasks/[taskId]/references/route'
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

describe('API /api/tasks/[taskId]/references (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testProductId: string
  let testTaskId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'references-test@example.com',
    })
    testUserId = user.id

    // 創建測試數據結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, {
      name: 'Test Project',
    })
    testProductId = product.id

    // 創建測試任務
    const task = await createTestTask(testUserId, testProductId, {
      content: 'Task for references test',
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

  describe('POST /api/tasks/[taskId]/references', () => {
    it('應該成功新增 URL reference', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: 'https://example.com',
          title: 'Example Website',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.reference).toHaveProperty('id')
      expect(data.reference).toHaveProperty('type', 'url')
      expect(data.reference).toHaveProperty('content', 'https://example.com')
      expect(data.reference).toHaveProperty('title', 'Example Website')
      expect(data.reference).toHaveProperty('created_at')
      expect(data).toHaveProperty('total', 1)
    })

    it('應該成功新增 note reference', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'note',
          content: 'This is a note about the task',
          title: 'Important Note',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.reference).toHaveProperty('type', 'note')
      expect(data.reference).toHaveProperty('content', 'This is a note about the task')
    })

    it('應該自動 trim 空格', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: '  https://trimmed.com  ',
          title: '  Trimmed Title  ',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.reference.content).toBe('https://trimmed.com')
      expect(data.reference.title).toBe('Trimmed Title')
    })

    it('應該在沒有 title 時設為 null', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: 'https://no-title.com',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.reference.title).toBeNull()
    })

    it('應該在 title 為空字符串時設為 null', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: 'https://empty-title.com',
          title: '   ',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.reference.title).toBeNull()
    })

    it('應該正確累計 total 數量', async () => {
      // 創建一個已有 references 的任務
      const taskWithRefs = await createTestTask(testUserId, testProductId, {
        content: 'Task with existing refs',
        references: [
          {
            id: randomUUID(),
            type: 'url',
            content: 'https://existing.com',
            title: 'Existing',
            created_at: new Date().toISOString(),
          },
        ],
      })

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: 'https://new.com',
          title: 'New',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: taskWithRefs.id }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('total', 2) // 原本 1 個 + 新增 1 個
    })

    it('應該在 type 無效時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'invalid-type',
          content: 'Some content',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'type' must be 'url' or 'note'")
    })

    it('應該在 type 缺失時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          content: 'Some content',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'type' must be 'url' or 'note'")
    })

    it('應該在 content 缺失時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'content' is required and cannot be empty")
    })

    it('應該在 content 為空時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: '   ',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'content' is required and cannot be empty")
    })

    it('應該在 content 不是 string 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: 123,
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'content' is required and cannot be empty")
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentTaskId = randomUUID()
      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          type: 'url',
          content: 'https://example.com',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: nonExistentTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Task not found')
    })

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'POST',
        headers: { authorization: 'Bearer invalid-token' },
        body: {
          type: 'url',
          content: 'https://example.com',
        },
      })

      const response = await POST(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('DELETE /api/tasks/[taskId]/references', () => {
    it('應該成功刪除 reference', async () => {
      // 創建一個帶有 references 的任務
      const referenceId = randomUUID()
      const taskWithRef = await createTestTask(testUserId, testProductId, {
        content: 'Task for delete test',
        references: [
          {
            id: referenceId,
            type: 'url',
            content: 'https://to-delete.com',
            title: 'To Delete',
            created_at: new Date().toISOString(),
          },
          {
            id: randomUUID(),
            type: 'note',
            content: 'Keep this note',
            title: 'Keep',
            created_at: new Date().toISOString(),
          },
        ],
      })

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
        url: `http://localhost/api/tasks/${taskWithRef.id}/references?referenceId=${referenceId}`,
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: taskWithRef.id }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('total', 1) // 原本 2 個,刪除 1 個剩 1 個

      // 驗證資料庫中已刪除
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskWithRef.id },
      })
      const references = updatedTask?.references as any[]
      expect(references.length).toBe(1)
      expect(references.find((ref: any) => ref.id === referenceId)).toBeUndefined()
    })

    it('應該在缺少 referenceId 參數時返回 400', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
        url: `http://localhost/api/tasks/${testTaskId}/references`, // 沒有 referenceId
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'referenceId' query parameter is required")
    })

    it('應該在 reference 不存在時返回 404', async () => {
      const nonExistentRefId = randomUUID()
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
        url: `http://localhost/api/tasks/${testTaskId}/references?referenceId=${nonExistentRefId}`,
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Reference not found')
    })

    it('應該在任務不存在時返回 404', async () => {
      const nonExistentTaskId = randomUUID()
      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
        url: `http://localhost/api/tasks/${nonExistentTaskId}/references?referenceId=ref-123`,
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: nonExistentTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Task not found')
    })

    it('應該在未認證時返回 401', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        method: 'DELETE',
        headers: { authorization: 'Bearer invalid-token' },
        url: `http://localhost/api/tasks/${testTaskId}/references?referenceId=ref-123`,
      })

      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: testTaskId }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })
  })
})
