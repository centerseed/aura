/**
 * Adjust Tags API 整合測試
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  setupIntegrationTests,
  cleanupIntegrationTests,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from '../setup'
import { POST } from '@/app/api/adjust-tags/route'
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

describe('POST /api/adjust-tags - Integration Tests', () => {
  let testAreaId: string
  let testProductId: string
  let testTaskId: string

  beforeAll(async () => {
    await setupIntegrationTests()

    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Adjust Tags Test Area',
        is_custom: true,
      },
    })
    testAreaId = area.id

    const product = await prisma.product.create({
      data: {
        user_id: TEST_USER_ID,
        area_id: testAreaId,
        name: 'Adjust Tags Test Product',
        status: 'ACTIVE',
        lifecycle: 'PERPETUAL',
      },
    })
    testProductId = product.id

    const task = await prisma.task.create({
      data: {
        user_id: TEST_USER_ID,
        product_id: testProductId,
        title: '實作登入功能',
        status: 'ACTIVE',
      },
    })
    testTaskId = task.id

    const { generateObject } = await import('ai')
    ;(generateObject as any).mockResolvedValue({
      object: {
        intent_type: 'move',
        reasoning: '用戶想移動任務',
        task_matches: [
          {
            task_id: testTaskId,
            task_title: '實作登入功能',
            confidence: 0.95,
            match_reason: '標題匹配',
          },
        ],
        target_product_name: 'Adjust Tags Test Product',
        target_product_id: testProductId,
      },
    })
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('preview mode → 200 + preview: true + structured_operations', async () => {
    const request = new NextRequest('http://localhost/api/adjust-tags', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: '把「實作登入功能」移到 Adjust Tags Test Product',
        preview: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data.data).toHaveProperty('preview', true)
    expect(data.data).toHaveProperty('structured_operations')
  })

  it('缺少 text → 400', async () => {
    const request = new NextRequest('http://localhost/api/adjust-tags', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('success', false)
  })
})
