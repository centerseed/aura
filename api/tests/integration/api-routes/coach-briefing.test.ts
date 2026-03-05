/**
 * Coach Briefing API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { POST } from '@/app/api/coach/briefing/route'
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

describe('POST /api/coach/briefing - Integration Tests', () => {
  beforeAll(async () => {
    await setupIntegrationTests()

    const { generateObject } = await import('ai')
    ;(generateObject as any).mockResolvedValue({
      object: {
        summary: '今天有 2 個待辦任務需要處理。',
        recommendations: [
          {
            priority: 1,
            action: '完成高優先任務',
            reasoning: '已逾期',
            related_task_id: null,
          },
        ],
        defer_suggestions: [],
        key_insight: '保持專注',
        mood: 'focused',
      },
    })
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('POST MORNING → 200 + briefing.type === MORNING', async () => {
    const request = new NextRequest('http://localhost/api/coach/briefing', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'MORNING' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data).toHaveProperty('briefing')
    expect(data.data.briefing).toHaveProperty('type', 'MORNING')
  })

  it('POST EVENING → 200 + briefing.type === EVENING', async () => {
    const request = new NextRequest('http://localhost/api/coach/briefing', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'EVENING' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data.briefing).toHaveProperty('type', 'EVENING')
  })

  it('type 無效 → 400', async () => {
    const request = new NextRequest('http://localhost/api/coach/briefing', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'INVALID' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('success', false)
  })
})
