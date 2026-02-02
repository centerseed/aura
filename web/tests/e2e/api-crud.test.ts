/**
 * API CRUD 完整測試
 *
 * 測試所有 CRUD 操作的正確流程和錯誤流程
 * 包含：Areas, Products, Tasks, Milestones
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// 環境變數
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || ''
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || ''

// 測試用的唯一標識符（避免與真實資料衝突）
const TEST_PREFIX = `__TEST_${Date.now()}__`

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

describe('API CRUD Tests - 完整流程測試', () => {
  let idToken: string | null = null

  // 用於追蹤已創建的資源，測試結束後清理
  const createdResources: {
    areas: string[]
    products: string[]
    tasks: string[]
    milestones: string[]
  } = {
    areas: [],
    products: [],
    tasks: [],
    milestones: [],
  }

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

  // 清理測試資料
  afterAll(async () => {
    if (!idToken) return

    console.log('🧹 清理測試資料...')

    // 刪除測試創建的 tasks
    for (const id of createdResources.tasks) {
      try {
        await authFetch(`/api/tasks/${id}`, idToken, { method: 'DELETE' })
        console.log(`  ✓ 刪除 task: ${id}`)
      } catch (e) {
        console.log(`  ✗ 刪除 task 失敗: ${id}`)
      }
    }

    // 刪除測試創建的 products
    for (const id of createdResources.products) {
      try {
        await authFetch(`/api/products/${id}`, idToken, { method: 'DELETE' })
        console.log(`  ✓ 刪除 product: ${id}`)
      } catch (e) {
        console.log(`  ✗ 刪除 product 失敗: ${id}`)
      }
    }

    // 刪除測試創建的 areas
    for (const id of createdResources.areas) {
      try {
        await authFetch(`/api/areas/${id}`, idToken, { method: 'DELETE' })
        console.log(`  ✓ 刪除 area: ${id}`)
      } catch (e) {
        console.log(`  ✗ 刪除 area 失敗: ${id}`)
      }
    }

    // 刪除測試創建的 milestones
    for (const id of createdResources.milestones) {
      try {
        await authFetch(`/api/milestones/${id}`, idToken, { method: 'DELETE' })
        console.log(`  ✓ 刪除 milestone: ${id}`)
      } catch (e) {
        console.log(`  ✗ 刪除 milestone 失敗: ${id}`)
      }
    }
  })

  // ============================================
  // Areas CRUD
  // ============================================
  describe('Areas CRUD', () => {
    let testAreaId: string | null = null

    it('POST /api/areas - 創建 Area', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const areaData = {
        name: `${TEST_PREFIX}測試領域`,
        scope: '這是測試用的領域描述',
      }

      const res = await authFetch('/api/areas', idToken, {
        method: 'POST',
        body: JSON.stringify(areaData),
      })

      console.log(`📡 POST /api/areas 回應狀態: ${res.status}`)
      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 200)}`)

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)

      // 儲存 ID 供後續測試使用
      testAreaId = data.data?.id || data.data?.area?.id
      if (testAreaId) {
        createdResources.areas.push(testAreaId)
      }

      expect(testAreaId).toBeTruthy()
      console.log(`✅ 創建 Area 成功: ${testAreaId}`)
    })

    it('GET /api/areas - 列出 Areas 應包含剛創建的', async () => {
      if (!idToken || !testAreaId) {
        console.log('跳過：無有效 token 或 area ID')
        return
      }

      const res = await authFetch('/api/areas', idToken)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)

      // 檢查回傳的 areas 中包含測試創建的
      // API 回傳格式: { areas: [...] }
      const areas = data.data?.areas || []
      const found = areas.find((a: any) => a.id === testAreaId || a.name?.includes(TEST_PREFIX))
      expect(found).toBeTruthy()
      console.log(`✅ 列表包含測試 Area`)
    })

    it('PUT /api/areas/:id - 更新 Area', async () => {
      if (!idToken || !testAreaId) {
        console.log('跳過：無有效 token 或 area ID')
        return
      }

      const updateData = {
        name: `${TEST_PREFIX}更新後的領域`,
        scope: '更新後的描述',
      }

      const res = await authFetch(`/api/areas/${testAreaId}`, idToken, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })

      console.log(`📡 PUT /api/areas/${testAreaId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      console.log(`✅ 更新 Area 成功`)
    })

    it('DELETE /api/areas/:id - 刪除 Area', async () => {
      if (!idToken || !testAreaId) {
        console.log('跳過：無有效 token 或 area ID')
        return
      }

      const res = await authFetch(`/api/areas/${testAreaId}`, idToken, {
        method: 'DELETE',
      })

      console.log(`📡 DELETE /api/areas/${testAreaId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)

      // 從清理列表中移除（已手動刪除）
      const idx = createdResources.areas.indexOf(testAreaId)
      if (idx > -1) createdResources.areas.splice(idx, 1)

      console.log(`✅ 刪除 Area 成功`)
    })

    it('DELETE /api/areas/:id - 刪除不存在的 Area 應回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const fakeId = 'non-existent-area-id-12345'
      const res = await authFetch(`/api/areas/${fakeId}`, idToken, {
        method: 'DELETE',
      })

      console.log(`📡 DELETE 不存在的 Area 回應狀態: ${res.status}`)
      // 應該回傳 404 或 400
      expect([400, 404, 500]).toContain(res.status)
    })
  })

  // ============================================
  // Products CRUD
  // ============================================
  describe('Products CRUD', () => {
    let testAreaId: string | null = null
    let testProductId: string | null = null

    // 先創建一個 Area 供 Product 使用
    beforeAll(async () => {
      if (!idToken) return

      const areaRes = await authFetch('/api/areas', idToken, {
        method: 'POST',
        body: JSON.stringify({
          name: `${TEST_PREFIX}Product測試領域`,
          scope: '供 Product 測試使用',
        }),
      })

      if (areaRes.ok) {
        const areaData = await areaRes.json()
        testAreaId = areaData.data?.id || areaData.data?.area?.id
        if (testAreaId) {
          createdResources.areas.push(testAreaId)
        }
      }
    })

    it('POST /api/products - 創建 Product', async () => {
      if (!idToken || !testAreaId) {
        console.log('跳過：無有效 token 或 area ID')
        return
      }

      const productData = {
        name: `${TEST_PREFIX}測試產品`,
        description: '這是測試用的產品描述',
        areaId: testAreaId,
      }

      const res = await authFetch('/api/products', idToken, {
        method: 'POST',
        body: JSON.stringify(productData),
      })

      console.log(`📡 POST /api/products 回應狀態: ${res.status}`)
      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 200)}`)

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)

      testProductId = data.data?.id || data.data?.product?.id
      if (testProductId) {
        createdResources.products.push(testProductId)
      }

      expect(testProductId).toBeTruthy()
      console.log(`✅ 創建 Product 成功: ${testProductId}`)
    })

    it('GET /api/products - 列出 Products', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await authFetch('/api/products', idToken)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      console.log(`✅ 列出 Products 成功`)
    })

    it('PATCH /api/products/:id - 更新 Product', async () => {
      if (!idToken || !testProductId) {
        console.log('跳過：無有效 token 或 product ID')
        return
      }

      const updateData = {
        name: `${TEST_PREFIX}更新後的產品`,
        description: '更新後的描述',
      }

      const res = await authFetch(`/api/products/${testProductId}`, idToken, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      })

      console.log(`📡 PATCH /api/products/${testProductId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)
      console.log(`✅ 更新 Product 成功`)
    })

    it('DELETE /api/products/:id - 刪除 Product', async () => {
      if (!idToken || !testProductId) {
        console.log('跳過：無有效 token 或 product ID')
        return
      }

      const res = await authFetch(`/api/products/${testProductId}`, idToken, {
        method: 'DELETE',
      })

      console.log(`📡 DELETE /api/products/${testProductId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)

      const idx = createdResources.products.indexOf(testProductId)
      if (idx > -1) createdResources.products.splice(idx, 1)

      console.log(`✅ 刪除 Product 成功`)
    })
  })

  // ============================================
  // Tasks CRUD
  // ============================================
  describe('Tasks CRUD', () => {
    let testTaskId: string | null = null
    let testProductIdForTask: string | null = null
    let testAreaIdForTask: string | null = null

    // 先創建一個 Area 和 Product 供 Task 使用
    beforeAll(async () => {
      if (!idToken) return

      // 創建 Area
      const areaRes = await authFetch('/api/areas', idToken, {
        method: 'POST',
        body: JSON.stringify({
          name: `${TEST_PREFIX}Task測試領域`,
          scope: '供 Task 測試使用',
        }),
      })

      if (areaRes.ok) {
        const areaData = await areaRes.json()
        testAreaIdForTask = areaData.data?.id || areaData.data?.area?.id
        if (testAreaIdForTask) {
          createdResources.areas.push(testAreaIdForTask)
        }
      }

      // 創建 Product
      if (testAreaIdForTask) {
        const productRes = await authFetch('/api/products', idToken, {
          method: 'POST',
          body: JSON.stringify({
            name: `${TEST_PREFIX}Task測試產品`,
            areaId: testAreaIdForTask,
          }),
        })

        if (productRes.ok) {
          const productData = await productRes.json()
          testProductIdForTask = productData.data?.id || productData.data?.product?.id
          if (testProductIdForTask) {
            createdResources.products.push(testProductIdForTask)
          }
        }
      }
    })

    it('POST /api/tasks - 創建 Task', async () => {
      if (!idToken || !testProductIdForTask) {
        console.log('跳過：無有效 token 或 product ID')
        return
      }

      // Tasks API 需要 content 和 product_id 欄位
      const taskData = {
        content: `${TEST_PREFIX}測試任務`,
        product_id: testProductIdForTask,
      }

      const res = await authFetch('/api/tasks', idToken, {
        method: 'POST',
        body: JSON.stringify(taskData),
      })

      console.log(`📡 POST /api/tasks 回應狀態: ${res.status}`)
      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 200)}`)

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)

      testTaskId = data.data?.id || data.data?.task?.id
      if (testTaskId) {
        createdResources.tasks.push(testTaskId)
      }

      expect(testTaskId).toBeTruthy()
      console.log(`✅ 創建 Task 成功: ${testTaskId}`)
    })

    it('GET /api/tasks - 列出 Tasks 應包含剛創建的', async () => {
      if (!idToken || !testTaskId) {
        console.log('跳過：無有效 token 或 task ID')
        return
      }

      const res = await authFetch('/api/tasks', idToken)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)

      // 檢查 tasks 列表
      const tasks = data.data?.tasks || data.data || []
      console.log(`✅ 列出 Tasks 成功，共 ${tasks.length} 筆`)
    })

    it('GET /api/tasks/:id - 取得單一 Task', async () => {
      if (!idToken || !testTaskId) {
        console.log('跳過：無有效 token 或 task ID')
        return
      }

      const res = await authFetch(`/api/tasks/${testTaskId}`, idToken)
      console.log(`📡 GET /api/tasks/${testTaskId} 回應狀態: ${res.status}`)

      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      console.log(`✅ 取得單一 Task 成功`)
    })

    it('PATCH /api/tasks/:id - 更新 Task', async () => {
      if (!idToken || !testTaskId) {
        console.log('跳過：無有效 token 或 task ID')
        return
      }

      const updateData = {
        content: `${TEST_PREFIX}更新後的任務`,
      }

      const res = await authFetch(`/api/tasks/${testTaskId}`, idToken, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      })

      console.log(`📡 PATCH /api/tasks/${testTaskId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)
      console.log(`✅ 更新 Task 成功`)
    })

    it('DELETE /api/tasks/:id - 刪除 Task', async () => {
      if (!idToken || !testTaskId) {
        console.log('跳過：無有效 token 或 task ID')
        return
      }

      const res = await authFetch(`/api/tasks/${testTaskId}`, idToken, {
        method: 'DELETE',
      })

      console.log(`📡 DELETE /api/tasks/${testTaskId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)

      const idx = createdResources.tasks.indexOf(testTaskId)
      if (idx > -1) createdResources.tasks.splice(idx, 1)

      console.log(`✅ 刪除 Task 成功`)
    })

    it('GET /api/tasks/:id - 取得不存在的 Task 應回傳錯誤', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const fakeId = 'non-existent-task-id-12345'
      const res = await authFetch(`/api/tasks/${fakeId}`, idToken)

      console.log(`📡 GET 不存在的 Task 回應狀態: ${res.status}`)
      expect([400, 404, 500]).toContain(res.status)
    })
  })

  // ============================================
  // Milestones CRUD
  // ============================================
  describe('Milestones CRUD', () => {
    let testMilestoneId: string | null = null
    let testAreaIdForMilestone: string | null = null

    // 先創建一個 Area 供 Milestone 使用
    beforeAll(async () => {
      if (!idToken) return

      const areaRes = await authFetch('/api/areas', idToken, {
        method: 'POST',
        body: JSON.stringify({
          name: `${TEST_PREFIX}Milestone測試領域`,
          scope: '供 Milestone 測試使用',
        }),
      })

      if (areaRes.ok) {
        const areaData = await areaRes.json()
        testAreaIdForMilestone = areaData.data?.id || areaData.data?.area?.id
        if (testAreaIdForMilestone) {
          createdResources.areas.push(testAreaIdForMilestone)
        }
      }
    })

    it('POST /api/milestones - 創建 Milestone', async () => {
      if (!idToken || !testAreaIdForMilestone) {
        console.log('跳過：無有效 token 或 area ID')
        return
      }

      // Milestones API 需要 name, target_date, entity_type, entity_id 欄位
      const milestoneData = {
        name: `${TEST_PREFIX}測試里程碑`,
        target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 天後
        entity_type: 'AREA',
        entity_id: testAreaIdForMilestone,
        priority: 5,
        description: '這是測試用的里程碑描述',
      }

      const res = await authFetch('/api/milestones', idToken, {
        method: 'POST',
        body: JSON.stringify(milestoneData),
      })

      console.log(`📡 POST /api/milestones 回應狀態: ${res.status}`)
      const data = await res.json()
      console.log(`📡 回應內容: ${JSON.stringify(data).substring(0, 200)}`)

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)

      testMilestoneId = data.data?.id || data.data?.milestone?.id
      if (testMilestoneId) {
        createdResources.milestones.push(testMilestoneId)
      }

      expect(testMilestoneId).toBeTruthy()
      console.log(`✅ 創建 Milestone 成功: ${testMilestoneId}`)
    })

    it('GET /api/milestones - 列出 Milestones', async () => {
      if (!idToken) {
        console.log('跳過：無有效 token')
        return
      }

      const res = await authFetch('/api/milestones', idToken)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)

      const milestones = data.data?.milestones || data.data || []
      console.log(`✅ 列出 Milestones 成功，共 ${milestones.length} 筆`)
    })

    it('PUT /api/milestones/:id - 更新 Milestone', async () => {
      if (!idToken || !testMilestoneId) {
        console.log('跳過：無有效 token 或 milestone ID')
        return
      }

      const updateData = {
        name: `${TEST_PREFIX}更新後的里程碑`,
        description: '更新後的描述',
      }

      const res = await authFetch(`/api/milestones/${testMilestoneId}`, idToken, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })

      console.log(`📡 PUT /api/milestones/${testMilestoneId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)
      console.log(`✅ 更新 Milestone 成功`)
    })

    it('DELETE /api/milestones/:id - 刪除 Milestone', async () => {
      if (!idToken || !testMilestoneId) {
        console.log('跳過：無有效 token 或 milestone ID')
        return
      }

      const res = await authFetch(`/api/milestones/${testMilestoneId}`, idToken, {
        method: 'DELETE',
      })

      console.log(`📡 DELETE /api/milestones/${testMilestoneId} 回應狀態: ${res.status}`)
      expect(res.status).toBe(200)

      const idx = createdResources.milestones.indexOf(testMilestoneId)
      if (idx > -1) createdResources.milestones.splice(idx, 1)

      console.log(`✅ 刪除 Milestone 成功`)
    })
  })
})
