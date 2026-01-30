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

// Mock AI SDK - use vi.hoisted to ensure proper initialization
const { mockGenerateObject } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
}))

import { POST } from '@/app/api/suggest-product/route'
import { createMockRequest } from '../../utils/test-helpers'
import {
  createTestUser,
  createTestArea,
  createTestProduct,
  cleanupTestData,
  disconnectDb,
} from '../../utils/db-helpers'

describe('POST /api/suggest-product (Integration)', () => {
  let testUserId: string
  let testFirebaseUid: string
  let testAreaId: string

  beforeAll(async () => {
    // 創建測試用戶
    testFirebaseUid = `firebase-test-uid-${randomUUID()}`
    const user = await createTestUser({
      auth_provider_id: testFirebaseUid,
      email: 'suggest-test@example.com',
    })
    testUserId = user.id

    // 創建測試 Area
    const area = await createTestArea(testUserId, { name: 'Personal' })
    testAreaId = area.id

    // 創建一些現有的 Products
    await createTestProduct(testUserId, testAreaId, { name: '技能學習' })
    await createTestProduct(testUserId, testAreaId, { name: '健康管理' })
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

    // 重置 AI mock
    mockGenerateObject.mockClear()
    mockGenerateObject.mockResolvedValue({
      object: {
        suggested_name: '社交活動',
        reasoning: '這個任務涉及人際互動，適合歸類在社交活動專案下。',
        alternative_names: ['人際往來', '朋友聚會'],
      },
    })
  })

  it('應該返回 AI 推薦的專案名稱', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        taskContent: '參加朋友婚禮',
        taskNarrative: '幫朋友慶祝人生大事',
        areaId: testAreaId,
        areaName: 'Personal',
        areaScope: '個人生活',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('suggestion')
    expect(data.suggestion).toHaveProperty('suggested_name')
    expect(data.suggestion).toHaveProperty('reasoning')
    expect(data.suggestion).toHaveProperty('alternative_names')
    expect(Array.isArray(data.suggestion.alternative_names)).toBe(true)
  })

  it('應該將現有的 Products 傳遞給 AI 以避免重複', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        taskContent: '學習 TypeScript',
        areaId: testAreaId,
        areaName: 'Personal',
      },
    })

    await POST(request)

    // 驗證 AI 被調用時收到了現有的 Products 列表
    expect(mockGenerateObject).toHaveBeenCalled()
    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.prompt).toContain('技能學習')
    expect(callArgs.prompt).toContain('健康管理')
  })

  it('應該在缺少 taskContent 時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        areaId: testAreaId,
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('required')
  })

  it('應該在缺少 areaId 時返回 400', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        taskContent: '參加朋友婚禮',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('required')
  })

  it('應該支援可選的 taskNarrative', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        taskContent: '參加朋友婚禮',
        taskNarrative: '很重要的朋友',
        areaId: testAreaId,
        areaName: 'Personal',
      },
    })

    await POST(request)

    // 驗證 narrative 被包含在 AI prompt 中
    expect(mockGenerateObject).toHaveBeenCalled()
    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.prompt).toContain('很重要的朋友')
  })

  it('應該支援可選的 areaScope', async () => {
    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        taskContent: '參加朋友婚禮',
        areaId: testAreaId,
        areaName: 'Personal',
        areaScope: '個人生活與社交',
      },
    })

    await POST(request)

    // 驗證 areaScope 被包含在 AI prompt 中
    expect(mockGenerateObject).toHaveBeenCalled()
    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.prompt).toContain('個人生活與社交')
  })

  it('應該在未認證時返回 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer invalid-token' },
      body: {
        taskContent: '參加朋友婚禮',
        areaId: testAreaId,
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error', 'Unauthorized')
  })

  it('應該在 AI 調用失敗時返回 500', async () => {
    mockGenerateObject.mockRejectedValue(new Error('AI service unavailable'))

    const request = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        taskContent: '參加朋友婚禮',
        areaId: testAreaId,
        areaName: 'Personal',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('Failed to suggest product name')
  })
})
