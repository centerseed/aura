import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 保存原始環境變數
const originalEnv = process.env

describe('api-client', () => {
  beforeEach(() => {
    // 重置模組快取
    vi.resetModules()
  })

  afterEach(() => {
    // 恢復環境變數
    process.env = originalEnv
  })

  describe('API_BASE_URL', () => {
    it('應該在設定 NEXT_PUBLIC_API_URL 時返回該值', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_API_URL: 'https://my-api.example.com',
      }

      const { API_BASE_URL } = await import('@/lib/api-client')
      expect(API_BASE_URL).toBe('https://my-api.example.com')
    })

    it('應該在未設定 NEXT_PUBLIC_API_URL 時返回空字串', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_API_URL: undefined,
      }

      const { API_BASE_URL } = await import('@/lib/api-client')
      expect(API_BASE_URL).toBe('')
    })
  })

  describe('apiUrl helper', () => {
    it('應該正確組合 API_BASE_URL 和端點路徑', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
      }

      const { apiUrl } = await import('@/lib/api-client')
      expect(apiUrl('/api/users')).toBe('https://api.example.com/api/users')
    })

    it('應該在 API_BASE_URL 為空時只返回端點路徑', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_API_URL: '',
      }

      const { apiUrl } = await import('@/lib/api-client')
      expect(apiUrl('/api/users')).toBe('/api/users')
    })
  })
})
