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

import { GET } from '@/app/api/users/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('GET /api/users (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'user-test@example.com',
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

  it('應該根據 Firebase Token 返回用戶資訊', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id', testUserId)
    expect(data).toHaveProperty('email', 'user-test@example.com')
    expect(data).toHaveProperty('name', 'Test User')
    expect(data).toHaveProperty('displayName')
    expect(data).toHaveProperty('areas')
    expect(data).toHaveProperty('hasAreas')
    expect(Array.isArray(data.areas)).toBe(true)
  })

  it('應該包含用戶的 Areas', async () => {
    // 創建測試 Area
    await createTestArea(testUserId, { name: 'Work' })
    await createTestArea(testUserId, { name: 'Personal' })

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.areas.length).toBeGreaterThanOrEqual(2)
    expect(data.hasAreas).toBe(true)
  })

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid or expired token'))

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer invalid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error', 'Unauthorized')
  })

  it('應該在缺少 authorization header 時返回 401', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {},
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error')
  })

  it('應該正確設定 displayName', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    // displayName 應該是 name 或 email（如果 name 不存在）
    expect(data.displayName).toBe('Test User')
  })

  it('應該在用戶不存在資料庫時返回錯誤', async () => {
    const nonExistentFirebaseUid = `non-existent-${randomUUID()}`
    mockVerifyIdToken.mockResolvedValue({ uid: nonExistentFirebaseUid })

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    // authenticateRequest 應該拋出錯誤
    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error')
  })
})
