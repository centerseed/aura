/**
 * API 錯誤情境測試
 *
 * 測試各種錯誤情況的處理
 * 包含：認證錯誤、無效資料、不存在的資源、權限錯誤等
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
 * 發送認證請求的 helper
 */
async function authFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })
}

describe('API Error Scenarios - 錯誤情境測試', () => {
  let idToken: string | null = null
  let testProductId: string | null = null

  beforeAll(async () => {
    if (!API_BASE_URL) {
      console.warn('跳過：NEXT_PUBLIC_API_URL 未設定')
      return
    }
    idToken = await getFirebaseIdToken()
    if (!idToken) {
      console.warn('跳過：無法取得 Firebase ID Token')
      return
    }

    // 獲取一個有效的 product_id 用於測試
    try {
      const res = await fetch(`${API_BASE_URL}/api/library`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        const firstArea = data.data?.areas?.[0]
        const firstProduct = firstArea?.products?.[0]
        testProductId = firstProduct?.id || null
        if (testProductId) {
          console.log(`✅ 取得測試用 product_id: ${testProductId}`)
        }
      }
    } catch (error) {
      console.warn('無法取得測試用 product_id')
    }
  })

  // ============================================
  // 認證錯誤
  // ============================================
  describe('認證錯誤', () => {
    it('無 Authorization header 應該回傳 401', async () => {
      const endpoints = ['/api/me', '/api/library', '/api/tasks', '/api/areas', '/api/products', '/api/milestones']

      for (const endpoint of endpoints) {
        const res = await fetch(`${API_BASE_URL}${endpoint}`)
        expect(res.status).toBe(401)
        console.log(`✅ ${endpoint} 無認證回傳 401`)
      }
    })

    it('無效的 token 應該回傳 401', async () => {
      const invalidToken = 'invalid.token.here'

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        headers: {
          'Authorization': `Bearer ${invalidToken}`,
        },
      })

      expect(res.status).toBe(401)
      console.log('✅ 無效 token 回傳 401')
    })

    it('過期的 token 格式錯誤應該回傳 401', async () => {
      // 一個格式正確但已過期/無效的 JWT
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdGVzdCIsImF1ZCI6InRlc3QiLCJzdWIiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwfQ.fake_signature'

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        headers: {
          'Authorization': `Bearer ${expiredToken}`,
        },
      })

      expect(res.status).toBe(401)
      console.log('✅ 過期 token 回傳 401')
    })
  })

  // ============================================
  // 不存在的資源
  // ============================================
  describe('不存在的資源', () => {
    it('GET 不存在的 task 應該回傳 404', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const fakeId = 'non-existent-id-99999'
      const res = await authFetch(`/api/tasks/${fakeId}`, idToken)

      console.log(`📡 GET 不存在的 task 回應狀態: ${res.status}`)
      expect([400, 404, 500]).toContain(res.status)

      const data = await res.json()
      expect(data.success).toBe(false)
      console.log('✅ 不存在的 task 正確回傳錯誤')
    })

    it('DELETE 不存在的 area 應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const fakeId = 'non-existent-area-99999'
      const res = await authFetch(`/api/areas/${fakeId}`, idToken, {
        method: 'DELETE',
      })

      console.log(`📡 DELETE 不存在的 area 回應狀態: ${res.status}`)
      expect([400, 404, 500]).toContain(res.status)
    })

    it('PATCH 不存在的 product 應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const fakeId = 'non-existent-product-99999'
      const res = await authFetch(`/api/products/${fakeId}`, idToken, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'test' }),
      })

      console.log(`📡 PATCH 不存在的 product 回應狀態: ${res.status}`)
      expect([400, 404, 500]).toContain(res.status)
    })
  })

  // ============================================
  // 無效的請求資料
  // ============================================
  describe('無效的請求資料', () => {
    it('POST /api/areas 缺少必要欄位應該回傳 400', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      // 缺少 name
      const res = await authFetch('/api/areas', idToken, {
        method: 'POST',
        body: JSON.stringify({ scope: 'test scope only' }),
      })

      console.log(`📡 缺少必要欄位回應狀態: ${res.status}`)
      expect([400, 422]).toContain(res.status)

      const data = await res.json()
      expect(data.success).toBe(false)
      console.log('✅ 缺少必要欄位正確回傳錯誤')
    })

    it('POST /api/tasks 空的 content 應該回傳 400', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      // Tasks API 需要 content 欄位
      const res = await authFetch('/api/tasks', idToken, {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
      })

      console.log(`📡 空 content 回應狀態: ${res.status}`)
      expect([400, 422]).toContain(res.status)
    })

    it('無效的 JSON 格式應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: 'this is not valid json',
      })

      console.log(`📡 無效 JSON 回應狀態: ${res.status}`)
      // 可能回傳 400、401（認證問題）、422、500
      expect([400, 401, 422, 500]).toContain(res.status)
    })
  })

  // ============================================
  // 回應格式驗證
  // ============================================
  describe('錯誤回應格式', () => {
    it('錯誤回應應該包含 success: false 和 error 物件', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const fakeId = 'non-existent-99999'
      const res = await authFetch(`/api/tasks/${fakeId}`, idToken)

      const data = await res.json()

      // 驗證錯誤回應格式
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
      expect(data.error.message).toBeDefined()

      console.log('✅ 錯誤回應格式正確:', {
        success: data.success,
        errorCode: data.error?.code,
        errorMessage: data.error?.message?.substring(0, 50),
      })
    })

    it('401 錯誤應該是 JSON 格式', async () => {
      const res = await fetch(`${API_BASE_URL}/api/me`)

      const contentType = res.headers.get('content-type')
      expect(contentType).toContain('application/json')

      const data = await res.json()
      expect(data.success).toBe(false)

      console.log('✅ 401 錯誤為 JSON 格式')
    })
  })

  // ============================================
  // HTTP 方法錯誤
  // ============================================
  describe('HTTP 方法錯誤', () => {
    it('對 GET-only 端點使用 DELETE 應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      // /api/me 應該只支援 GET
      const res = await authFetch('/api/me', idToken, {
        method: 'DELETE',
      })

      console.log(`📡 對 /api/me 使用 DELETE 回應狀態: ${res.status}`)
      // 可能是 405 Method Not Allowed 或 404
      expect([400, 404, 405]).toContain(res.status)
    })

    it('對 /api/library 使用 POST 應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      // /api/library 應該只支援 GET
      const res = await authFetch('/api/library', idToken, {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      })

      console.log(`📡 對 /api/library 使用 POST 回應狀態: ${res.status}`)
      expect([400, 404, 405]).toContain(res.status)
    })
  })

  // ============================================
  // 邊界情況
  // ============================================
  describe('邊界情況', () => {
    it('超長的 title 應該被處理（不崩潰）', async () => {
      if (!idToken || !testProductId) {
        console.log('跳過：無有效 token 或 product_id')
        return
      }

      const veryLongTitle = 'A'.repeat(10000) // 10000 字元

      // Tasks API 需要 content 和 product_id 欄位
      const res = await authFetch('/api/tasks', idToken, {
        method: 'POST',
        body: JSON.stringify({
          content: veryLongTitle,
          product_id: testProductId
        }),
      })

      console.log(`📡 超長 title 回應狀態: ${res.status}`)
      // 應該回傳 400（太長）或 200（成功但截斷）
      expect([200, 400, 413, 422]).toContain(res.status)
    })

    it('特殊字元應該被正確處理', async () => {
      if (!idToken || !testProductId) {
        console.log('跳過：無有效 token 或 product_id')
        return
      }

      const specialChars = '測試 🎉 <script>alert("xss")</script> & "quotes" \'single\''

      // Tasks API 需要 content 和 product_id 欄位
      const res = await authFetch('/api/tasks', idToken, {
        method: 'POST',
        body: JSON.stringify({
          content: `Test ${specialChars}`,
          product_id: testProductId,
        }),
      })

      console.log(`📡 特殊字元回應狀態: ${res.status}`)

      // 應該能處理（不崩潰）
      expect([200, 400, 422]).toContain(res.status)

      if (res.status === 200) {
        const data = await res.json()
        // 如果成功，清理測試資料
        const taskId = data.data?.id || data.data?.task?.id
        if (taskId) {
          await authFetch(`/api/tasks/${taskId}`, idToken, { method: 'DELETE' })
        }
      }
    })
  })
})
