# API Response Validation 測試系統

## 為什麼需要這個測試？

**問題：TypeScript 只做編譯時檢查，測不到 runtime 的 API 回應錯誤**

```typescript
// TypeScript 會通過，但 runtime 會爆炸
const libraryData = await API.library()
libraryData.map(...) // ❌ TypeError: libraryData.map is not a function
```

**原因**：
1. `npm run build` 只檢查語法，不知道 API 實際回傳什麼
2. 型別標註是 `any`，TypeScript 直接放行
3. Backend 改了回應格式，Frontend 不知道

## 解決方案：Runtime Type Validation

### 1. Zod Schema 定義 ([lib/api-schemas.ts](../lib/api-schemas.ts))

```typescript
export const ApiSchemas = {
  // /api/library 必須回傳 { areas: Area[] }
  library: z.object({
    areas: z.array(AreaSchema),
  }),

  // /api/milestones 必須回傳 { milestones: Milestone[] }
  milestones: z.object({
    milestones: z.array(MilestoneSchema),
  }),
}
```

### 2. API Client 自動驗證 ([lib/api-client.ts](../lib/api-client.ts))

```typescript
export const API = {
  library: async () => {
    const response = await fetchWithAuth('/api/library', { method: 'GET' });
    return handleResponse(response, ApiSchemas.library); // ✅ 自動驗證
  },
}
```

### 3. 測試確保驗證有效 ([tests/unit/lib/api-response-validation.test.ts](./unit/lib/api-response-validation.test.ts))

```typescript
it('❌ 錯誤格式：直接是 array（會導致 libraryData.map error）', () => {
  const invalidResponse = [{ id: 'area-1', name: 'Test Area', products: [] }]

  const result = ApiSchemas.library.safeParse(invalidResponse)
  expect(result.success).toBe(false) // ✅ 測試會抓到這個問題
})
```

## 如何執行測試

```bash
# 執行所有 API validation 測試
npm test -- api-response-validation.test.ts

# 執行所有測試
npm test
```

## 測試涵蓋的錯誤案例

這些測試會抓到以下 runtime 錯誤：

### ❌ `libraryData.map is not a function`
```typescript
// 錯誤：Backend 回傳 array 而不是 { areas: [...] }
const libraryData = [{ id: 'area-1', ... }] // ❌
libraryData.map(...) // TypeError
```

### ❌ `milestones.filter is not a function`
```typescript
// 錯誤：Backend 回傳 array 而不是 { milestones: [...] }
const milestones = [{ id: 'm1', ... }] // ❌
milestones.filter(...) // TypeError
```

### ❌ `areas.some is not a function`
```typescript
// 錯誤：areas 不是 array
const areas = null // ❌
areas.some(...) // TypeError
```

### ❌ `products.map is not a function`
```typescript
// 錯誤：products 不是 array
const products = null // ❌
products.map(...) // TypeError
```

## 測試報告範例

```bash
✓ tests/unit/lib/api-response-validation.test.ts (14)
  ✓ API Response Format Validation (14)
    ✓ /api/library 回應格式 (4)
      ✓ ✅ 正確格式：{ areas: [...] }
      ✓ ❌ 錯誤格式：直接是 array（會導致 libraryData.map error）
      ✓ ❌ 錯誤格式：areas 不是 array
      ✓ ✅ areas 是空 array
    ✓ /api/milestones 回應格式 (3)
      ✓ ✅ 正確格式：{ milestones: [...] }
      ✓ ❌ 錯誤格式：直接是 array（會導致 milestones.filter error）
      ✓ ❌ 錯誤格式：milestones 不是 array
    ✓ /api/tasks 回應格式 (2)
    ✓ 嵌套資料結構驗證 (3)
    ✓ 實際使用情境：前端代碼會這樣用 (2)

Test Files  1 passed (1)
     Tests  14 passed (14)
```

## 如果測試失敗會怎樣？

**在開發環境 (npm run dev)**：
- Console 會顯示 validation error
- API call 會拋出 `VALIDATION_ERROR`
- 開發者可以立刻看到格式問題

**在生產環境 (部署前的 build)**：
- Build 會成功（TypeScript 靜態檢查通過）
- 但 Runtime validation 會在實際調用時報錯
- 建議：部署前先跑 integration tests

## 新增 API 時如何加入驗證

### Step 1: 定義 Schema
```typescript
// lib/api-schemas.ts
export const ApiSchemas = {
  myNewEndpoint: z.object({
    data: z.array(z.string()),
  }),
}
```

### Step 2: 加入 API Client
```typescript
// lib/api-client.ts
export const API = {
  myNew: {
    list: async () => {
      const response = await fetchWithAuth('/api/my-new', { method: 'GET' });
      return handleResponse(response, ApiSchemas.myNewEndpoint);
    },
  },
}
```

### Step 3: 寫測試
```typescript
// tests/unit/lib/api-response-validation.test.ts
it('✅ 正確格式', () => {
  const validResponse = { data: ['item1', 'item2'] }
  const result = ApiSchemas.myNewEndpoint.safeParse(validResponse)
  expect(result.success).toBe(true)
})

it('❌ 錯誤格式：data 不是 array', () => {
  const invalidResponse = { data: null }
  const result = ApiSchemas.myNewEndpoint.safeParse(invalidResponse)
  expect(result.success).toBe(false)
})
```

## 相關檔案

- [lib/api-schemas.ts](../lib/api-schemas.ts) - Zod schema 定義
- [lib/api-client.ts](../lib/api-client.ts) - API client with validation
- [tests/unit/lib/api-response-validation.test.ts](./unit/lib/api-response-validation.test.ts) - 測試

## 重要提醒

**這個測試系統會抓到：**
✅ API 回應格式錯誤（array vs object）
✅ 欄位缺失或型別錯誤
✅ 嵌套資料結構問題

**這個測試系統抓不到：**
❌ 業務邏輯錯誤
❌ API 沒有被調用
❌ 非 API 相關的 runtime 錯誤

建議搭配 Integration Tests 和 E2E Tests 達到完整測試覆蓋。
