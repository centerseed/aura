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

import { GET } from '@/app/api/me/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('GET /api/me (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'test@example.com',
      name: 'Test User',
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

  it('應該返回當前用戶的資訊', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveProperty('id', testUserId)
    expect(data.data).toHaveProperty('email', 'test@example.com')
    expect(data.data).toHaveProperty('name', 'Test User')
    expect(data.data).toHaveProperty('displayName')
    expect(data).toHaveProperty('auth_provider')
    expect(data.data).toHaveProperty('areas')
    expect(data.data).toHaveProperty('hasAreas')
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
    expect(data.data.hasAreas).toBe(true)
  })

  it('應該在未認證時返回 401', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {},
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.message).toBe('Invalid or expired token')
  })

  it('應該在 token 無效時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token verification'))

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer invalid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.message).toBe('Invalid token')
  })

  it('應該在用戶不存在時返回 404', async () => {
    const nonExistentFirebaseUid = `non-existent-${randomUUID()}`
    mockVerifyIdToken.mockResolvedValue({ uid: nonExistentFirebaseUid })

    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.message).toBe('User not found')
  })

  it('應該正確設定 displayName（使用 name）', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.displayName).toBe('Test User')
  })

  it('應該在沒有 Bearer 前綴時返回 401', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: { authorization: 'invalid-format-token' },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.message).toBe('Invalid or expired token')
  })
})
