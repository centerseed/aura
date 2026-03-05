/**
 * Coach Focus Bias API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { GET } from '@/app/api/coach/focus-bias/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))

describe('GET /api/coach/focus-bias - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('GET 200 + 回傳 products[] 與 focus_drift_detected', async () => {
    const request = new NextRequest('http://localhost/api/coach/focus-bias?days=7', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data).toHaveProperty('products')
    expect(data.data).toHaveProperty('focus_drift_detected')
    expect(Array.isArray(data.data.products)).toBe(true)
  })

  it('days 超出上限時正常 clamp（不報錯）', async () => {
    const request = new NextRequest('http://localhost/api/coach/focus-bias?days=999', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    // days 被 clamp 到 90，不報錯
    expect(response.status).toBe(200)
    expect(data.data.period_days).toBe(90)
  })
})
