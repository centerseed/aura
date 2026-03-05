/**
 * Coach Plan API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET, POST } from '@/app/api/coach/plan/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

vi.mock('@/lib/ai-rate-limit', () => ({
  checkAiRateLimit: vi.fn().mockResolvedValue(undefined),
  incrementAiUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'mock-model'),
}))

describe('Coach Plan API - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()

    const { generateObject } = await import('ai')
    ;(generateObject as any).mockResolvedValue({
      object: {
        coach_message: '今天的計畫已生成，保持專注！',
        items: [
          {
            task_id: null,
            content: '完成高優先任務',
            estimated_minutes: 60,
            order: 1,
          },
        ],
      },
    })
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  describe('GET /api/coach/plan', () => {
    it('無既有 plan → 200 + plan === null', async () => {
      const request = new NextRequest('http://localhost/api/coach/plan', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data).toHaveProperty('plan')
      // 新建用戶沒有計畫，應該是 null
      expect(data.data.plan).toBeNull()
    })
  })

  describe('POST /api/coach/plan', () => {
    it('200 + 回傳 plan.items[]', async () => {
      const request = new NextRequest('http://localhost/api/coach/plan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data.data).toHaveProperty('plan')
      expect(data.data.plan).toHaveProperty('items')
      expect(Array.isArray(data.data.plan.items)).toBe(true)
    })
  })
})
