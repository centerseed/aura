/**
 * firebase-admin 單元測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase-admin 模組
const mockAuth = {
  verifyIdToken: vi.fn(),
}

const mockApp = {
  delete: vi.fn(),
}

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(() => mockApp),
    credential: {
      cert: vi.fn(),
    },
    auth: vi.fn(() => mockAuth),
  },
  apps: [],
  initializeApp: vi.fn(() => mockApp),
  credential: {
    cert: vi.fn(),
  },
  auth: vi.fn(() => mockAuth),
}))

beforeEach(() => {
  // 清除環境變數
  delete process.env.FIREBASE_ADMIN_KEY
  delete process.env.FIREBASE_ADMIN_TYPE
  delete process.env.FIREBASE_ADMIN_PROJECT_ID

  // 清除 module cache 以確保重新載入
  vi.resetModules()
  vi.clearAllMocks()
})

describe('firebase-admin', () => {
  describe('getAuth with FIREBASE_ADMIN_KEY', () => {
    it('應該使用 FIREBASE_ADMIN_KEY 環境變數初始化', async () => {
      const mockServiceAccount = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test.iam.gserviceaccount.com',
        client_id: '123456',
      }

      process.env.FIREBASE_ADMIN_KEY = JSON.stringify(mockServiceAccount)

      const { getAuth } = await import('@/lib/firebase-admin')
      const auth = getAuth()

      expect(auth).toBeDefined()
    })

    it('應該拋出錯誤當 FIREBASE_ADMIN_KEY 格式錯誤', async () => {
      process.env.FIREBASE_ADMIN_KEY = 'invalid-json'

      const { getAuth } = await import('@/lib/firebase-admin')

      expect(() => getAuth()).toThrow('Invalid FIREBASE_ADMIN_KEY environment variable')
    })
  })

  describe('getAuth with individual environment variables', () => {
    it('應該使用個別環境變數初始化', async () => {
      process.env.FIREBASE_ADMIN_TYPE = 'service_account'
      process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project'
      process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID = 'test-key-id'
      process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n'
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com'
      process.env.FIREBASE_ADMIN_CLIENT_ID = '123456'

      const { getAuth } = await import('@/lib/firebase-admin')
      const auth = getAuth()

      expect(auth).toBeDefined()
    })

    it('應該正確處理 private_key 中的換行符號', async () => {
      process.env.FIREBASE_ADMIN_TYPE = 'service_account'
      process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project'
      process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID = 'test-key-id'
      // 測試換行符號的轉換
      process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nline1\\nline2\\n-----END PRIVATE KEY-----\\n'
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com'
      process.env.FIREBASE_ADMIN_CLIENT_ID = '123456'

      const { getAuth } = await import('@/lib/firebase-admin')
      const auth = getAuth()

      expect(auth).toBeDefined()
    })
  })

  describe('singleton pattern', () => {
    it('應該返回相同的 auth instance', async () => {
      const mockServiceAccount = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test.iam.gserviceaccount.com',
        client_id: '123456',
      }

      process.env.FIREBASE_ADMIN_KEY = JSON.stringify(mockServiceAccount)

      const { getAuth } = await import('@/lib/firebase-admin')
      const auth1 = getAuth()
      const auth2 = getAuth()

      expect(auth1).toBe(auth2)
    })
  })
})
