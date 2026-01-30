import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Firebase Admin BEFORE importing auth-middleware
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

// Now import the module to test
import { authenticateRequest, verifyIdToken, getUserIdFromFirebaseUid } from '@/lib/auth-middleware'
import { prismaMock } from '../../mocks/prisma'
import { createMockRequest, createMockUser } from '../../utils/test-helpers'

// Helper functions
function mockAuthenticatedUser(userId: string, firebaseUid = 'test-firebase-uid') {
  mockVerifyIdToken.mockResolvedValue({ uid: firebaseUid })
  return { userId, firebaseUid }
}

function mockUnauthenticatedUser() {
  mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))
}

describe('auth-middleware', () => {
  describe('verifyIdToken', () => {
    it('應該驗證有效 token 並返回 Firebase UID', async () => {
      const mockFirebaseUid = 'firebase-uid-123'
      mockVerifyIdToken.mockResolvedValue({ uid: mockFirebaseUid })

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      })

      const result = await verifyIdToken(request)

      expect(result).toBe(mockFirebaseUid)
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token')
    })

    it('應該在缺少 authorization header 時拋出錯誤', async () => {
      const request = createMockRequest({ headers: {} })

      await expect(verifyIdToken(request)).rejects.toThrow('Missing or invalid token')
    })

    it('應該在 authorization header 不是 Bearer 格式時拋出錯誤', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Basic invalid-format' },
      })

      await expect(verifyIdToken(request)).rejects.toThrow('Missing or invalid token')
    })

    it('應該在 authorization header 只有 Bearer 沒有 token 時拋出錯誤', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer ' },
      })

      // Firebase 會拋出錯誤因為 token 是空字串
      mockUnauthenticatedUser()

      await expect(verifyIdToken(request)).rejects.toThrow('Invalid or expired token')
    })

    it('應該在 token 過期時拋出錯誤', async () => {
      mockUnauthenticatedUser()

      const request = createMockRequest({
        headers: { authorization: 'Bearer expired-token' },
      })

      await expect(verifyIdToken(request)).rejects.toThrow('Invalid or expired token')
    })

    it('應該在 token 無效時拋出錯誤', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'))

      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      })

      await expect(verifyIdToken(request)).rejects.toThrow('Invalid or expired token')
    })

    it('應該正確提取 Bearer token（移除 "Bearer " 前綴）', async () => {
      const mockFirebaseUid = 'test-uid'
      mockVerifyIdToken.mockResolvedValue({ uid: mockFirebaseUid })

      const request = createMockRequest({
        headers: { authorization: 'Bearer my-special-token-123' },
      })

      await verifyIdToken(request)

      expect(mockVerifyIdToken).toHaveBeenCalledWith('my-special-token-123')
    })
  })

  describe('getUserIdFromFirebaseUid', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('應該根據 Firebase UID 返回資料庫 user ID', async () => {
      const mockUser = createMockUser({
        id: 'db-user-id-123',
        auth_provider_id: 'firebase-uid-123',
      })

      prismaMock.user.findFirst.mockResolvedValue(mockUser as any)

      const result = await getUserIdFromFirebaseUid('firebase-uid-123', prismaMock)

      expect(result).toBe('db-user-id-123')
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { auth_provider_id: 'firebase-uid-123' },
      })
    })

    it('應該在找不到用戶時返回 null', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      const result = await getUserIdFromFirebaseUid('non-existent-uid', prismaMock)

      expect(result).toBeNull()
    })

    it('應該使用正確的 Prisma 查詢參數', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      await getUserIdFromFirebaseUid('test-uid', prismaMock)

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          auth_provider_id: 'test-uid',
        },
      })
    })
  })

  describe('authenticateRequest', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('應該成功認證並返回資料庫 user ID', async () => {
      const { userId, firebaseUid } = mockAuthenticatedUser('db-user-id')
      const mockUser = createMockUser({
        id: userId,
        auth_provider_id: firebaseUid,
      })

      prismaMock.user.findFirst.mockResolvedValue(mockUser as any)

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      })

      const result = await authenticateRequest(request, prismaMock)

      expect(result).toBe(userId)
      expect(mockVerifyIdToken).toHaveBeenCalled()
      expect(prismaMock.user.findFirst).toHaveBeenCalled()
    })

    it('應該在缺少 token 時拋出錯誤', async () => {
      const request = createMockRequest({
        headers: {},
      })

      await expect(authenticateRequest(request, prismaMock)).rejects.toThrow('Missing or invalid token')
    })

    it('應該在 token 無效時拋出錯誤', async () => {
      mockUnauthenticatedUser()

      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      })

      await expect(authenticateRequest(request, prismaMock)).rejects.toThrow('Invalid or expired token')
    })

    it('應該在資料庫找不到用戶時拋出錯誤', async () => {
      mockAuthenticatedUser('db-user-id')
      prismaMock.user.findFirst.mockResolvedValue(null)

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      })

      await expect(authenticateRequest(request, prismaMock)).rejects.toThrow(
        'Invalid token: User not found in database'
      )
    })

    it('應該按正確順序執行認證流程（先驗證 token，再查詢資料庫）', async () => {
      const { userId, firebaseUid } = mockAuthenticatedUser('user-123')
      const mockUser = createMockUser({
        id: userId,
        auth_provider_id: firebaseUid,
      })

      const callOrder: string[] = []

      mockVerifyIdToken.mockImplementation(async () => {
        callOrder.push('verifyToken')
        return { uid: firebaseUid }
      })

      prismaMock.user.findFirst.mockImplementation(async () => {
        callOrder.push('findUser')
        return mockUser as any
      })

      const request = createMockRequest({
        headers: { authorization: 'Bearer token' },
      })

      await authenticateRequest(request, prismaMock)

      expect(callOrder).toEqual(['verifyToken', 'findUser'])
    })

    it('應該在 token 驗證失敗時不查詢資料庫', async () => {
      mockUnauthenticatedUser()

      const request = createMockRequest({
        headers: { authorization: 'Bearer bad-token' },
      })

      await expect(authenticateRequest(request, prismaMock)).rejects.toThrow()

      // 確認沒有呼叫 Prisma
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    })

    it('應該處理多個不同用戶的認證請求', async () => {
      // 第一個用戶
      const user1 = mockAuthenticatedUser('user-1', 'firebase-uid-1')
      prismaMock.user.findFirst.mockResolvedValueOnce(createMockUser({
        id: user1.userId,
        auth_provider_id: user1.firebaseUid,
      }) as any)

      const request1 = createMockRequest({
        headers: { authorization: 'Bearer token1' },
      })
      const result1 = await authenticateRequest(request1, prismaMock)
      expect(result1).toBe('user-1')

      // 第二個用戶
      const user2 = mockAuthenticatedUser('user-2', 'firebase-uid-2')
      prismaMock.user.findFirst.mockResolvedValueOnce(createMockUser({
        id: user2.userId,
        auth_provider_id: user2.firebaseUid,
      }) as any)

      const request2 = createMockRequest({
        headers: { authorization: 'Bearer token2' },
      })
      const result2 = await authenticateRequest(request2, prismaMock)
      expect(result2).toBe('user-2')
    })
  })

  describe('邊界情況', () => {
    it('應該處理 authorization header 中的額外空格', async () => {
      const mockFirebaseUid = 'test-uid'
      mockVerifyIdToken.mockResolvedValue({ uid: mockFirebaseUid })

      // 注意："Bearer  " 有兩個空格
      const request = createMockRequest({
        headers: { authorization: 'Bearer  token-with-extra-space' },
      })

      await verifyIdToken(request)

      // 應該提取 " token-with-extra-space"（包含前導空格）
      expect(mockVerifyIdToken).toHaveBeenCalledWith(' token-with-extra-space')
    })

    it('應該處理大小寫不同的 Bearer', async () => {
      const request = createMockRequest({
        headers: { authorization: 'bearer token' },
      })

      // 應該失敗，因為代碼只檢查 "Bearer "（大寫 B）
      await expect(verifyIdToken(request)).rejects.toThrow('Missing or invalid token')
    })

    it('應該在 Prisma 查詢失敗時拋出錯誤', async () => {
      prismaMock.user.findFirst.mockRejectedValue(new Error('Database connection failed'))

      await expect(getUserIdFromFirebaseUid('test-uid', prismaMock)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})
