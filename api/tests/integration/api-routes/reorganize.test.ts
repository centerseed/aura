/**
 * Reorganize API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { POST } from '@/app/api/reorganize/route'
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

describe('POST /api/reorganize - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()

    const { generateObject } = await import('ai')
    ;(generateObject as any).mockResolvedValue({
      object: {
        analysis: '結構合理，沒有需要合併的專案',
        merges: [],
        reclassifications: [],
      },
    })
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('preview mode → 200 + preview: true', async () => {
    const request = new NextRequest('http://localhost/api/reorganize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preview: true }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    // 無資料時回傳 "No data to reorganize" 或 preview: true
    const isNoData = data.data?.message === 'No data to reorganize'
    const isPreview = data.data?.preview === true
    expect(isNoData || isPreview).toBe(true)
  })

  it('confirmed mode → 200 + changes', async () => {
    const request = new NextRequest('http://localhost/api/reorganize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmed: true }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data).toHaveProperty('changes')
  })
})
