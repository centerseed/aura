/**
 * API Smoke Test
 *
 * 這些測試真正呼叫 API 端點，驗證前後端連線正常。
 * 需要後端服務在運行中才能執行這些測試。
 *
 * 執行方式：
 * 1. 確保 API 後端在運行 (本地或遠端)
 * 2. 在 .env.test 設定：
 *    - NEXT_PUBLIC_API_URL
 *    - TEST_USER_EMAIL
 *    - TEST_USER_PASSWORD
 *    - NEXT_PUBLIC_FIREBASE_API_KEY
 * 3. npm run test:e2e
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
      const error = await res.json()
      console.error('Firebase 登入失敗:', error.error?.message || error)
      return null
    }

    const data = await res.json()
    return data.idToken
  } catch (error) {
    console.error('Firebase 登入錯誤:', error)
    return null
  }
}

describe('API Smoke Tests - 真實 API 呼叫', () => {
  beforeAll(() => {
    if (!API_BASE_URL) {
      console.warn('⚠️  NEXT_PUBLIC_API_URL 未設定，跳過 smoke tests')
    }
  })

  describe('API 可連線測試', () => {
    it('API 服務應該回應請求', async () => {
      if (!API_BASE_URL) {
        console.log('跳過：NEXT_PUBLIC_API_URL 未設定')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/me`)
      expect(res.status).toBeLessThan(500)
      console.log(`✅ API 回應狀態: ${res.status}`)
    })
  })

  describe('未認證請求', () => {
    it('GET /api/me 無 token 應該回傳 401', async () => {
      if (!API_BASE_URL) {
        console.log('跳過：NEXT_PUBLIC_API_URL 未設定')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/me`)
      expect(res.status).toBe(401)
    })

    it('GET /api/library 無 token 應該回傳 401', async () => {
      if (!API_BASE_URL) {
        console.log('跳過：NEXT_PUBLIC_API_URL 未設定')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/library`)
      expect(res.status).toBe(401)
    })

    it('GET /api/tasks 無 token 應該回傳 401', async () => {
      if (!API_BASE_URL) {
        console.log('跳過：NEXT_PUBLIC_API_URL 未設定')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/tasks`)
      expect(res.status).toBe(401)
    })
  })

  describe('CORS 設定', () => {
    it('OPTIONS 請求應該包含正確的 CORS headers', async () => {
      if (!API_BASE_URL) {
        console.log('跳過：NEXT_PUBLIC_API_URL 未設定')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://zentropy-4f7a5.web.app',
          'Access-Control-Request-Method': 'GET',
        }
      })

      expect([200, 204]).toContain(res.status)
      const corsHeader = res.headers.get('Access-Control-Allow-Origin')
      expect(corsHeader).toBeTruthy()
    })
  })

  describe('API 回應格式', () => {
    it('錯誤回應應該是 JSON 格式', async () => {
      if (!API_BASE_URL) {
        console.log('跳過：NEXT_PUBLIC_API_URL 未設定')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/me`)
      const contentType = res.headers.get('Content-Type')
      expect(contentType).toContain('application/json')

      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })
})

describe('API 認證測試 - 使用測試帳號', () => {
  let idToken: string | null = null

  beforeAll(async () => {
    if (!API_BASE_URL) {
      console.warn('⚠️  跳過認證測試：NEXT_PUBLIC_API_URL 未設定')
      return
    }

    if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
      console.warn('⚠️  跳過認證測試：TEST_USER_EMAIL 或 TEST_USER_PASSWORD 未設定')
      console.warn('   請在 .env.test 設定測試帳號')
      return
    }

    console.log(`🔐 使用測試帳號登入: ${TEST_USER_EMAIL}`)
    idToken = await getFirebaseIdToken()

    if (idToken) {
      console.log('✅ 成功取得 Firebase ID Token')
    } else {
      console.warn('⚠️  無法取得 ID Token，認證測試將被跳過')
    }
  })

  describe('GET /api/me - 取得當前用戶', () => {
    it('使用有效 token 應該回傳 200 和用戶資料', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      console.log(`🔑 Token 前 50 字元: ${idToken.substring(0, 50)}...`)

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })

      console.log(`📡 /api/me 回應狀態: ${res.status}`)

      const data = await res.json()
      console.log(`📡 /api/me 回應內容:`, JSON.stringify(data).substring(0, 200))

      if (res.status !== 200) {
        console.error(`❌ API 錯誤: ${data.error || JSON.stringify(data)}`)
      }

      expect(res.status).toBe(200)

      // API 回傳格式是 { success, data: { user: {...} } }
      expect(data.success).toBe(true)
      expect(data.data?.user).toHaveProperty('id')
      expect(data.data?.user).toHaveProperty('email')
      console.log(`👤 用戶資料: id=${data.data?.user?.id}, email=${data.data?.user?.email}`)
    })
  })

  describe('GET /api/library - 取得用戶資料', () => {
    it('使用有效 token 應該回傳 200 和 library 資料', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/library`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      console.log(`📡 /api/library 回應狀態: ${res.status}`)

      expect(res.status).toBe(200)

      const data = await res.json()
      // API 回傳格式: { success, data: { areas: [...] } }
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('areas')
      console.log(`📚 Areas 數量: ${data.data?.areas?.length || 0}`)
    })
  })

  describe('GET /api/tasks - 取得任務列表', () => {
    it('使用有效 token 應該回傳 200 和 tasks 資料', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      console.log(`📡 /api/tasks 回應狀態: ${res.status}`)

      expect(res.status).toBe(200)

      const data = await res.json()
      // API 回傳格式: { success, data: [...] } 或直接 [...]
      const tasks = Array.isArray(data) ? data : (data.data || data)
      expect(Array.isArray(tasks) || data.success).toBe(true)
      console.log(`📋 Tasks: ${JSON.stringify(data).substring(0, 100)}`)
    })
  })

  describe('GET /api/milestones - 取得里程碑', () => {
    it('使用有效 token 應該回傳 200', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/milestones`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      console.log(`📡 /api/milestones 回應狀態: ${res.status}`)

      expect(res.status).toBe(200)

      const data = await res.json()
      console.log(`🎯 Milestones 數量: ${data.milestones?.length || 0}`)
    })
  })
})

describe('API 連線診斷', () => {
  it('顯示 API 設定資訊', () => {
    console.log('\n📋 API 設定資訊:')
    console.log(`   NEXT_PUBLIC_API_URL = "${API_BASE_URL || '(未設定)'}"`)
    console.log(`   FIREBASE_API_KEY = "${FIREBASE_API_KEY ? '✓ 已設定' : '(未設定)'}"`)
    console.log(`   TEST_USER_EMAIL = "${TEST_USER_EMAIL || '(未設定)'}"`)
    console.log(`   TEST_USER_PASSWORD = "${TEST_USER_PASSWORD ? '✓ 已設定' : '(未設定)'}"`)
    console.log(`   環境: ${process.env.NODE_ENV}`)

    if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
      console.log('\n⚠️  提示: 在 .env.test 設定 TEST_USER_EMAIL 和 TEST_USER_PASSWORD')
      console.log('   以執行完整的認證 API 測試')
    }

    expect(true).toBe(true)
  })
})
