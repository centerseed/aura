/**
 * LLM API 測試
 *
 * 測試所有 AI/LLM 相關 API 的成功路徑
 * 包含：brain-dump, adjust-tags, suggest-product, reorganize
 *
 * 注意：這些測試會實際呼叫 LLM，可能需要較長時間
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

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

describe('LLM API Tests - AI 功能測試', () => {
  let idToken: string | null = null

  beforeAll(async () => {
    if (!API_BASE_URL) {
      console.warn('跳過：NEXT_PUBLIC_API_URL 未設定')
      return
    }
    idToken = await getFirebaseIdToken()
    if (!idToken) {
      console.warn('跳過：無法取得 Firebase ID Token')
    }
  })

  // ============================================
  // Brain Dump API
  // ============================================
  describe('POST /api/brain-dump - Brain Dump 功能', () => {
    it('應該能處理簡單的文字輸入並回傳結構化結果', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      // Brain-dump API 需要 text 欄位，不是 content
      const brainDumpData = {
        text: '我需要完成專案報告，下週三截止。還要記得買牛奶和麵包。',
      }

      console.log('🧠 發送 Brain Dump 請求...')
      const res = await authFetch('/api/brain-dump', idToken, {
        method: 'POST',
        body: JSON.stringify(brainDumpData),
      })

      console.log(`📡 POST /api/brain-dump 回應狀態: ${res.status}`)

      // LLM API 可能回傳 200、201 或 429（rate limit）
      expect([200, 201, 429]).toContain(res.status)

      if (res.status === 429) {
        console.log('⚠️ Rate limit 觸發，跳過內容驗證')
        return
      }

      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 300)}`)

      expect(data.success).toBe(true)
      // Brain dump 應該回傳處理後的結果
      expect(data.data).toBeDefined()

      console.log('✅ Brain Dump 成功處理')
    }, 30000) // LLM 可能需要較長時間

    it('空內容應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await authFetch('/api/brain-dump', idToken, {
        method: 'POST',
        body: JSON.stringify({ text: '' }),
      })

      console.log(`📡 空內容 Brain Dump 回應狀態: ${res.status}`)
      // 應該回傳 400 錯誤，或 429（rate limit）
      expect([400, 422, 429]).toContain(res.status)
    })
  })

  // ============================================
  // Suggest Product API
  // ============================================
  describe('POST /api/suggest-product - 產品建議功能', () => {
    let testAreaId: string | null = null

    // 先創建一個 Area 供測試使用
    beforeAll(async () => {
      if (!idToken) return

      const areaRes = await authFetch('/api/areas', idToken, {
        method: 'POST',
        body: JSON.stringify({
          name: `__TEST_LLM_${Date.now()}__事業`,
          scope: '創業經營',
        }),
      })

      if (areaRes.ok) {
        const areaData = await areaRes.json()
        testAreaId = areaData.data?.id || areaData.data?.area?.id
      }
    })

    // 清理測試資料
    afterAll(async () => {
      if (idToken && testAreaId) {
        try {
          await authFetch(`/api/areas/${testAreaId}`, idToken, { method: 'DELETE' })
        } catch (e) {
          // 忽略清理錯誤
        }
      }
    })

    it('應該能根據輸入建議產品', async () => {
      if (!idToken || !testAreaId) {
        console.log('跳過：無有效 token 或 area ID')
        return
      }

      // Suggest-product API 需要 taskContent, areaId, areaName 欄位
      const suggestData = {
        taskContent: '我想開始一個電商網站，賣手工藝品',
        taskNarrative: '規劃電商平台的開發和營運',
        areaId: testAreaId,
        areaName: '事業',
        areaScope: '創業經營',
      }

      console.log('💡 發送產品建議請求...')
      const res = await authFetch('/api/suggest-product', idToken, {
        method: 'POST',
        body: JSON.stringify(suggestData),
      })

      console.log(`📡 POST /api/suggest-product 回應狀態: ${res.status}`)

      expect([200, 201, 429]).toContain(res.status)

      if (res.status === 429) {
        console.log('⚠️ Rate limit 觸發，跳過內容驗證')
        return
      }

      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 300)}`)

      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()

      console.log('✅ 產品建議成功')
    }, 30000)
  })

  // ============================================
  // Adjust Tags API
  // ============================================
  describe('POST /api/adjust-tags - 標籤調整功能', () => {
    it('應該能調整標籤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      // Adjust-tags API 需要 text 欄位
      const tagsData = {
        text: '把所有跟購物有關的任務移到電商專案',
      }

      console.log('🏷️ 發送標籤調整請求...')
      const res = await authFetch('/api/adjust-tags', idToken, {
        method: 'POST',
        body: JSON.stringify(tagsData),
      })

      console.log(`📡 POST /api/adjust-tags 回應狀態: ${res.status}`)

      expect([200, 201, 429]).toContain(res.status)

      if (res.status === 429) {
        console.log('⚠️ Rate limit 觸發，跳過內容驗證')
        return
      }

      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 300)}`)

      expect(data.success).toBe(true)

      console.log('✅ 標籤調整成功')
    }, 30000)
  })

  // ============================================
  // Reorganize API
  // ============================================
  // NOTE: 此測試 skip — reorganize 會載入測試帳號完整 library 傳給 LLM，
  // 回應時間不可控（依帳號資料量而定），不適合作為部署 gate 測試。
  // 功能驗證請用 /baseline-ai-functions skill 手動執行。
  describe.skip('POST /api/reorganize - 重新組織功能', () => {
    it('應該能重新組織任務', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await authFetch('/api/reorganize', idToken, {
        method: 'POST',
        body: JSON.stringify({ preview: true }),
      })

      expect([200, 201, 429]).toContain(res.status)

      if (res.status !== 429) {
        const data = await res.json()
        expect(data.success).toBe(true)
      }
    }, 120000)
  })

  // ============================================
  // 錯誤處理測試
  // ============================================
  describe('LLM API 錯誤處理', () => {
    it('無認證應該回傳 401', async () => {
      const res = await fetch(`${API_BASE_URL}/api/brain-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      })

      expect(res.status).toBe(401)
    })

    it('無效的請求格式應該回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await authFetch('/api/brain-dump', idToken, {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'text/plain',
        },
      })

      console.log(`📡 無效格式回應狀態: ${res.status}`)
      // 應該回傳 400、401、415 等錯誤，或 429（rate limit）
      expect([400, 401, 415, 422, 429, 500]).toContain(res.status)
    })
  })
})
