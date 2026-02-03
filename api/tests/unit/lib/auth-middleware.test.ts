/**
 * auth-middleware 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  verifyIdToken,
  authenticateRequest,
} from '@/lib/auth-middleware'
import * as firebaseAdmin from '@/lib/firebase-admin'

// Mock firebase-admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(),
}))

describe('auth-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyIdToken', () => {
    it('應該成功驗證有效的 token', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-firebase-uid' }),
      }
      vi.mocked(firebaseAdmin.getAuth).mockReturnValue(mockAuth as any)

      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const uid = await verifyIdToken(request)
      expect(uid).toBe('test-firebase-uid')
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token')
    })

    it('應該拋出錯誤當沒有 Authorization header', async () => {
      const request = new NextRequest('http://localhost')

      await expect(verifyIdToken(request)).rejects.toThrow(
        'Missing or invalid token'
      )
    })

    it('應該拋出錯誤當 Authorization header 格式錯誤', async () => {
      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'InvalidFormat token',
        },
      })

      await expect(verifyIdToken(request)).rejects.toThrow(
        'Missing or invalid token'
      )
    })

    it('應該拋出錯誤當 token 無效', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }
      vi.mocked(firebaseAdmin.getAuth).mockReturnValue(mockAuth as any)

      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      await expect(verifyIdToken(request)).rejects.toThrow(
        'Invalid or expired token'
      )
    })

    it('應該拋出錯誤當 token 過期', async () => {
      const mockAuth = {
        verifyIdToken: vi
          .fn()
          .mockRejectedValue(new Error('Firebase ID token has expired')),
      }
      vi.mocked(firebaseAdmin.getAuth).mockReturnValue(mockAuth as any)

      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'Bearer expired-token',
        },
      })

      await expect(verifyIdToken(request)).rejects.toThrow(
        'Invalid or expired token'
      )
    })
  })


  describe('authenticateRequest', () => {
    it('應該成功驗證請求並返回 user ID', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'firebase-uid-123' }),
      }
      vi.mocked(firebaseAdmin.getAuth).mockReturnValue(mockAuth as any)

      const mockPrisma = {
        user: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'user-123',
            auth_provider_id: 'firebase-uid-123',
          }),
        },
      }

      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const userId = await authenticateRequest(request, mockPrisma)
      expect(userId).toBe('user-123')
    })

    it('應該拋出錯誤當 token 無效', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }
      vi.mocked(firebaseAdmin.getAuth).mockReturnValue(mockAuth as any)

      const mockPrisma = {
        user: {
          findFirst: vi.fn(),
        },
      }

      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      await expect(authenticateRequest(request, mockPrisma)).rejects.toThrow()
    })

    it('應該自動創建用戶當用戶不存在於資料庫', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'firebase-uid-999',
          email: 'newuser@example.com',
          name: 'New User',
        }),
      }
      vi.mocked(firebaseAdmin.getAuth).mockReturnValue(mockAuth as any)

      const mockPrisma = {
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'new-user-123',
            email: 'newuser@example.com',
            name: 'New User',
            auth_provider: 'GOOGLE',
            auth_provider_id: 'firebase-uid-999',
          }),
        },
      }

      const request = new NextRequest('http://localhost', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const userId = await authenticateRequest(request, mockPrisma)

      expect(userId).toBe('new-user-123')
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          auth_provider: 'GOOGLE',
          auth_provider_id: 'firebase-uid-999',
        },
      })
    })
  })
})
