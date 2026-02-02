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

import { PATCH } from '@/app/api/tasks/[taskId]/references/[referenceId]/route'
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

describe('PATCH /api/tasks/[taskId]/references/[referenceId] (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testProductId: string
  let testTaskId: string
  let referenceId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'ref-id-test@example.com',
    })
    testUserId = user.id

    // 創建測試數據結構
    const area = await createTestArea(testUserId, { name: 'Work' })
    const product = await createTestProduct(testUserId, area.id, {
      name: 'Test Project',
    })
    testProductId = product.id

    // 創建帶有 references 的任務
    referenceId = randomUUID()
    const task = await createTestTask(testUserId, testProductId, {
      content: 'Task with References',
      references: [
        {
          id: referenceId,
          type: 'url',
          content: 'https://example.com',
          title: 'Original Title',
          created_at: new Date().toISOString(),
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

  it('應該成功更新 reference 的 content', async () => {
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        content: 'https://updated-url.com',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data.reference).toHaveProperty('content', 'https://updated-url.com')
    expect(data.data.reference).toHaveProperty('title', 'Original Title')

    // 驗證資料庫中的更新
    const updatedTask = await prisma.task.findUnique({
      where: { id: testTaskId },
    })
    const references = updatedTask?.references as any[]
    expect(references[0].content).toBe('https://updated-url.com')
  })

  it('應該成功更新 reference 的 title', async () => {
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        title: 'Updated Title',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data.reference).toHaveProperty('title', 'Updated Title')
  })

  it('應該同時更新 content 和 title', async () => {
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        content: 'https://new-url.com',
        title: 'New Title',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data.reference).toHaveProperty('content', 'https://new-url.com')
    expect(data.data.reference).toHaveProperty('title', 'New Title')
  })

  it('應該自動 trim 空格', async () => {
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        content: '  https://trimmed-url.com  ',
        title: '  Trimmed Title  ',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reference.content).toBe('https://trimmed-url.com')
    expect(data.reference.title).toBe('Trimmed Title')
  })

  it('應該在 title 為空字符串時設為 null', async () => {
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        title: '',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reference.title).toBeNull()
  })

  it('應該在任務不存在時返回 404', async () => {
    const nonExistentTaskId = randomUUID()
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        content: 'https://new-url.com',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: nonExistentTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.message).toBe('Task not found')
  })

  it('應該在 reference 不存在時返回 404', async () => {
    const nonExistentRefId = randomUUID()
    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        content: 'https://new-url.com',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId: nonExistentRefId }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.message).toBe('Reference not found')
  })

  it('應該在未認證時返回 500 (auth error)', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'PATCH',
      headers: { authorization: 'Bearer invalid-token' },
      body: {
        content: 'https://new-url.com',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ taskId: testTaskId, referenceId }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.message).toBe('Failed to update reference')
  })
})
