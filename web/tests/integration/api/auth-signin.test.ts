import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { POST } from '@/app/api/auth/signin/route'
import { createMockRequest } from '../../utils/test-helpers'
import { prisma } from '@/lib/db'
import { cleanupTestData, disconnectDb } from '../../utils/db-helpers'

describe('POST /api/auth/signin (Integration)', () => {
  const testUserIds: string[] = []

  afterAll(async () => {
    // 清理所有測試用戶
    for (const userId of testUserIds) {
      await cleanupTestData(userId)
    }
    await disconnectDb()
  })

  describe('Google SSO 登入', () => {
    it('應該為新的 Google 用戶創建帳號', async () => {
      const providerId = `google-${randomUUID()}`
      const email = `test-${randomUUID()}@example.com`

      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'google',
          providerId,
          email,
          name: 'Google User',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('email', email)
      expect(data).toHaveProperty('name', 'Google User')
      expect(data).toHaveProperty('authProvider', 'GOOGLE')

      testUserIds.push(data.id)
    })

    it('應該為已存在的 Google 用戶返回資訊', async () => {
      const providerId = `google-existing-${randomUUID()}`
      const email = `existing-${randomUUID()}@example.com`

      // 首次登入
      const request1 = createMockRequest({
        method: 'POST',
        body: {
          provider: 'google',
          providerId,
          email,
          name: 'Existing User',
        },
      })

      const response1 = await POST(request1)
      const data1 = await response1.json()
      testUserIds.push(data1.id)

      // 第二次登入
      const request2 = createMockRequest({
        method: 'POST',
        body: {
          provider: 'google',
          providerId,
          email,
          name: 'Updated Name',
        },
      })

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.id).toBe(data1.id)
      expect(data2.name).toBe('Updated Name')
      expect(data2.email).toBe(email)
    })

    it('應該在缺少 providerId 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'google',
          email: 'test@example.com',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Google')
    })

    it('應該在缺少 email 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'google',
          providerId: 'some-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Google')
    })

    it('應該在沒有 name 時使用 email 前綴作為名稱', async () => {
      const providerId = `google-${randomUUID()}`
      const email = `autoname@example.com`

      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'google',
          providerId,
          email,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('autoname')

      testUserIds.push(data.id)
    })
  })

  describe('匿名登入', () => {
    it('應該為新的匿名用戶創建帳號', async () => {
      const providerId = `anon-${randomUUID()}`

      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'anonymous',
          providerId,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('email', null)
      expect(data).toHaveProperty('name', '訪客')
      expect(data).toHaveProperty('authProvider', 'ANONYMOUS')

      testUserIds.push(data.id)
    })

    it('應該為已存在的匿名用戶返回資訊', async () => {
      const providerId = `anon-existing-${randomUUID()}`

      // 首次登入
      const request1 = createMockRequest({
        method: 'POST',
        body: {
          provider: 'anonymous',
          providerId,
        },
      })

      const response1 = await POST(request1)
      const data1 = await response1.json()
      testUserIds.push(data1.id)

      // 第二次登入
      const request2 = createMockRequest({
        method: 'POST',
        body: {
          provider: 'anonymous',
          providerId,
        },
      })

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.id).toBe(data1.id)
    })

    it('應該在缺少 providerId 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'anonymous',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('匿名')
    })

    it('應該支援自訂名稱的匿名用戶', async () => {
      const providerId = `anon-${randomUUID()}`

      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'anonymous',
          providerId,
          name: 'Custom Guest',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('Custom Guest')

      testUserIds.push(data.id)
    })
  })

  describe('Email 登入', () => {
    it('應該為新的 Email 用戶創建帳號', async () => {
      const email = `email-${randomUUID()}@example.com`

      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'email',
          email,
          name: 'Email User',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('email', email)
      expect(data).toHaveProperty('name', 'Email User')
      expect(data).toHaveProperty('authProvider', 'EMAIL')

      testUserIds.push(data.id)
    })

    it('應該為已存在的 Email 用戶更新名稱', async () => {
      const email = `email-existing-${randomUUID()}@example.com`

      // 首次登入
      const request1 = createMockRequest({
        method: 'POST',
        body: {
          provider: 'email',
          email,
          name: 'Original Name',
        },
      })

      const response1 = await POST(request1)
      const data1 = await response1.json()
      testUserIds.push(data1.id)

      // 第二次登入，更新名稱
      const request2 = createMockRequest({
        method: 'POST',
        body: {
          provider: 'email',
          email,
          name: 'Updated Name',
        },
      })

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.id).toBe(data1.id)
      expect(data2.name).toBe('Updated Name')
    })

    it('應該在缺少 email 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'email',
          name: 'User',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('應該在缺少 name 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'email',
          email: 'test@example.com',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })
  })

  describe('錯誤處理', () => {
    it('應該在缺少 provider 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', '需要提供認證方式')
    })

    it('應該在不支援的 provider 時返回 400', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          provider: 'unsupported',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', '不支援的認證方式')
    })
  })
})
