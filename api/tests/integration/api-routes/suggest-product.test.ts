/**
 * Suggest Product API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { POST } from '@/app/api/suggest-product/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

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

describe('POST /api/suggest-product - Integration Tests', () => {
  let testAreaId: string

  beforeAll(async () => {
    await setupIntegrationTests()
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Suggest Product Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    const { generateObject } = await import('ai')
    ;(generateObject as any).mockResolvedValue({
      object: {
        suggested_name: 'AI 推薦專案名稱',
        reasoning: '基於任務內容分析',
        confidence: 0.85,
      },
    })
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('POST 200 + 回傳 suggestion.suggested_name', async () => {
    const request = new NextRequest('http://localhost/api/suggest-product', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskContent: '實作用戶登入功能',
        areaId: testAreaId,
        areaName: 'Suggest Product Test Area',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data).toHaveProperty('suggestion')
    expect(data.data.suggestion).toHaveProperty('suggested_name')
  })

  it('缺少 areaId → 400', async () => {
    const request = new NextRequest('http://localhost/api/suggest-product', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskContent: '實作用戶登入功能',
        // 故意省略 areaId
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('success', false)
  })
})
