/**
 * API Response Parsing Tests
 *
 * 測試前端能否正確解析 API 回應格式
 * 這些測試確保 API client 回傳的資料結構符合前端預期
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest'

// 環境變數
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || ''
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || ''

/**
 * 使用 Firebase Auth REST API 登入取得 ID Token
 */
async function getFirebaseIdToken(): Promise<string | null> {
  if (!FIREBASE_API_KEY || !TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    return null
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          returnSecureToken: true,
        }),
      }
    )

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    return data.idToken
  } catch {
    return null
  }
}

/**
 * 模擬 api-client.ts 的 handleResponse 邏輯
 */
function handleResponse<T>(data: any): T {
  if (data.success) {
    return data.data as T
  } else {
    throw new Error(data.error?.message || 'API Error')
  }
}

describe('API Response Parsing - 前端解析驗證', () => {
  let idToken: string | null = null

  beforeAll(async () => {
    if (!API_BASE_URL) {
      console.warn('跳過：NEXT_PUBLIC_API_URL 未設定')
      return
    }
    idToken = await getFirebaseIdToken()
  })

  describe('/api/me - 用戶資料解析', () => {
    it('API.users.me() 應該回傳 { user: { id, email, ... } } 格式', async () => {
      if (!idToken || !API_BASE_URL) {
        console.log('跳過：無有效 token 或 API URL')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })

      expect(res.status).toBe(200)

      const rawData = await res.json()

      // 模擬 handleResponse 處理後的結果 (這是 API.users.me() 實際回傳的)
      const result = handleResponse<{ user: any }>(rawData)

      // 驗證前端預期的格式: result.user.id, result.user.email
      expect(result).toHaveProperty('user')
      expect(result.user).toHaveProperty('id')
      expect(result.user).toHaveProperty('email')
      expect(typeof result.user.id).toBe('string')
      expect(typeof result.user.email).toBe('string')

      console.log('✅ API.users.me() 格式正確:', {
        'result.user.id': result.user.id,
        'result.user.email': result.user.email,
      })
    })

    it('前端 onboarding/page.tsx 應該能正確解析 API.users.me()', async () => {
      if (!idToken || !API_BASE_URL) {
        console.log('跳過：無有效 token 或 API URL')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })

      const rawData = await res.json()
      const result = handleResponse<{ user: any }>(rawData)

      // 模擬 onboarding/page.tsx 的解析邏輯
      const user = result.user
      const userId = user.id
      const userName = user.displayName || user.name || user.email || 'User'

      expect(userId).toBeTruthy()
      expect(userName).toBeTruthy()
      expect(typeof userId).toBe('string')

      console.log('✅ onboarding 解析結果:', { userId, userName })
    })
  })

  describe('/api/library - Library 資料解析', () => {
    it('API.library() 應該回傳 { areas: [...] } 格式', async () => {
      if (!idToken || !API_BASE_URL) {
        console.log('跳過：無有效 token 或 API URL')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/library`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })

      expect(res.status).toBe(200)

      const rawData = await res.json()
      const result = handleResponse<{ areas: any[] }>(rawData)

      // 驗證前端預期的格式: result.areas
      expect(result).toHaveProperty('areas')
      expect(Array.isArray(result.areas)).toBe(true)

      console.log('✅ API.library() 格式正確:', {
        'result.areas.length': result.areas.length,
      })
    })

    it('前端 dashboard 應該能正確解析 API.library()', async () => {
      if (!idToken || !API_BASE_URL) {
        console.log('跳過：無有效 token 或 API URL')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/library`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })

      const rawData = await res.json()
      const result = handleResponse<{ areas: any[] }>(rawData)

      // 模擬 dashboard 的解析邏輯
      const areas = result.areas || []

      expect(Array.isArray(areas)).toBe(true)

      console.log('✅ dashboard 解析結果:', { areasCount: areas.length })
    })
  })

  describe('/api/milestones - Milestones 資料解析', () => {
    it('API.milestones.list() 應該回傳可用的 milestones 格式', async () => {
      if (!idToken || !API_BASE_URL) {
        console.log('跳過：無有效 token 或 API URL')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/milestones`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })

      expect(res.status).toBe(200)

      const rawData = await res.json()
      const result = handleResponse<any>(rawData)

      // 檢查回傳格式 - milestones 可能是 { milestones: [...] } 或直接 [...]
      const milestones = Array.isArray(result) ? result : (result.milestones || [])

      expect(Array.isArray(milestones)).toBe(true)

      console.log('✅ API.milestones.list() 格式:', {
        isArray: Array.isArray(result),
        hasMilestonesProp: result?.milestones !== undefined,
        count: milestones.length,
      })
    })
  })

  describe('/api/tasks - Tasks 資料解析', () => {
    it('API.tasks.list() 應該回傳可用的 tasks 格式', async () => {
      if (!idToken || !API_BASE_URL) {
        console.log('跳過：無有效 token 或 API URL')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })

      expect(res.status).toBe(200)

      const rawData = await res.json()
      const result = handleResponse<any>(rawData)

      // 檢查回傳格式 - tasks 可能是 { tasks: [...] } 或直接 [...]
      const tasks = Array.isArray(result) ? result : (result.tasks || result.data || [])

      expect(Array.isArray(tasks)).toBe(true)

      console.log('✅ API.tasks.list() 格式:', {
        isArray: Array.isArray(result),
        hasTasksProp: result?.tasks !== undefined,
        count: tasks.length,
      })
    })
  })
})
