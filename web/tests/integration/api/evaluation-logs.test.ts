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

import { GET, PATCH } from '@/app/api/evaluation/logs/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'
import { prisma } from '@/lib/db'

describe('Evaluation Logs API (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testLogId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'eval-test@example.com',
    })
    testUserId = user.id

    // 創建測試評估日誌
    const log = await prisma.systemEvaluationLog.create({
      data: {
        user_id: testUserId,
        type: 'BRAIN_DUMP',
        user_action: 'PENDING',
        input_content: 'Test input content',
        output_content: { result: 'test output' },
        metadata: {
          test: 'data',
        },
      },
    })
    testLogId = log.id
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

  describe('GET /api/evaluation/logs', () => {
    it('應該返回用戶的評估日誌列表', async () => {
      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('total')
      expect(data).toHaveProperty('logs')
      expect(Array.isArray(data.logs)).toBe(true)
      expect(data.logs.length).toBeGreaterThan(0)
      expect(data.logs[0]).toHaveProperty('id')
      expect(data.logs[0]).toHaveProperty('type')
      expect(data.logs[0]).toHaveProperty('user_action')
      expect(data.logs[0]).toHaveProperty('user')
    })

    it('應該支援 type 過濾', async () => {
      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
        url: 'http://localhost/api/evaluation/logs?type=BRAIN_DUMP',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.logs.every((log: any) => log.type === 'BRAIN_DUMP')).toBe(true)
    })

    it('應該支援 userAction 過濾', async () => {
      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
        url: 'http://localhost/api/evaluation/logs?userAction=PENDING',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.logs.every((log: any) => log.user_action === 'PENDING')).toBe(true)
    })

    it('應該支援分頁（limit 和 offset）', async () => {
      // 創建多個日誌
      for (let i = 0; i < 5; i++) {
        await prisma.systemEvaluationLog.create({
          data: {
            user_id: testUserId,
            type: 'BRAIN_DUMP',
            user_action: 'PENDING',
            input_content: `Test input ${i}`,
            output_content: { result: `output ${i}` },
          },
        })
      }

      const request = createMockRequest({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
        url: 'http://localhost/api/evaluation/logs?limit=3&offset=1',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.limit).toBe(3)
      expect(data.data.offset).toBe(1)
      expect(data.logs.length).toBeLessThanOrEqual(3)
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
  })

  describe('PATCH /api/evaluation/logs', () => {
    it('應該更新日誌的 userAction', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        body: {
          logId: testLogId,
          userAction: 'APPLIED',
        },
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data.log).toHaveProperty('user_action', 'APPLIED')
    })

    it('應該支援更新 metadata', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        body: {
          logId: testLogId,
          userAction: 'EDITED',
          metadata: {
            edited_by: 'user',
            reason: 'test update',
          },
        },
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.log.metadata).toHaveProperty('edited_by', 'user')
    })

    it('應該在缺少 logId 時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        body: {
          userAction: 'APPLIED',
        },
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.message).toContain('required')
    })

    it('應該在缺少 userAction 時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        body: {
          logId: testLogId,
        },
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.message).toContain('required')
    })

    it('應該在 userAction 無效時返回 400', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        body: {
          logId: testLogId,
          userAction: 'INVALID_ACTION',
        },
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error.message).toContain('Invalid userAction')
    })
  })
})
