# 整合測試指南

## 概述

整合測試用於驗證應用程序的各個組件在真實環境下的協作。與單元測試不同，整合測試會：

- 使用真實的資料庫連線
- 驗證 API routes 的完整流程
- 測試資料庫遷移和模型定義
- 確保環境變數正確配置

## 為什麼需要整合測試？

單元測試使用 mock 來隔離測試，但這意味著：

- 無法發現資料庫連線問題（例如：缺少 `DATABASE_URL` 環境變數）
- 無法驗證 Prisma schema 與實際資料庫的一致性
- 無法測試真實的 API 請求/回應流程

**實例**：之前部署到 Cloud Run 時，`DATABASE_URL` 環境變數缺失導致生產環境錯誤。如果有整合測試，這個問題在部署前就會被發現。

## 環境設置

### 1. 測試資料庫

建議使用獨立的測試資料庫：

```bash
# .env.test
DATABASE_URL="postgresql://test:test@localhost:5432/zentropy_test"
GOOGLE_GENERATIVE_AI_API_KEY="test-key"
FIREBASE_ADMIN_KEY='{"type":"service_account","project_id":"test",...}'
```

### 2. Firebase 測試環境

整合測試需要 mock Firebase Authentication：

```typescript
import { vi } from 'vitest'
import * as firebaseAdmin from '@/lib/firebase-admin'

// Mock Firebase auth
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: TEST_FIREBASE_UID }),
  })),
}))
```

## 運行整合測試

```bash
# 設置測試環境變數
export NODE_ENV=test

# 運行整合測試
npm run test tests/integration/

# 運行特定測試
npm run test tests/integration/api-routes/me.test.ts
```

## 撰寫整合測試

### 基本範例

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupIntegrationTests, cleanupIntegrationTests, TEST_USER_ID } from '../setup'
import { GET } from '@/app/api/me/route'
import { NextRequest } from 'next/server'

describe('GET /api/me', () => {
  beforeAll(async () => {
    await setupIntegrationTests()
  })

  afterAll(async () => {
    await cleanupIntegrationTests()
  })

  it('應該返回當前用戶資訊', async () => {
    const request = new NextRequest('http://localhost/api/me', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.id).toBe(TEST_USER_ID)
  })
})
```

## 測試資料管理

### 使用 setupIntegrationTests()

`setupIntegrationTests()` 會：
- 建立測試用戶
- 初始化必要的測試資料

### 使用 cleanupIntegrationTests()

`cleanupIntegrationTests()` 會：
- 刪除所有測試資料
- 清理資料庫狀態

### 自訂測試資料

```typescript
import { prisma } from '@/lib/db'

async function createTestTask() {
  return await prisma.task.create({
    data: {
      user_id: TEST_USER_ID,
      product_id: testProductId,
      content: 'Test task',
      status: 'INBOX',
    },
  })
}
```

## 最佳實踐

1. **隔離測試**：每個測試應該獨立，不依賴其他測試的狀態
2. **清理資料**：使用 `afterEach` 或 `afterAll` 清理測試資料
3. **真實場景**：盡可能模擬真實用戶行為
4. **錯誤處理**：測試正常情況和錯誤情況

## 與 CI/CD 整合

在 CI/CD pipeline 中：

1. 啟動測試資料庫容器
2. 運行資料庫遷移
3. 執行整合測試
4. 清理資源

```yaml
# GitHub Actions 範例
- name: Start Test Database
  run: docker-compose up -d postgres

- name: Run Migrations
  run: npx prisma migrate deploy

- name: Run Integration Tests
  run: npm run test tests/integration/
```

## 注意事項

- 整合測試比單元測試慢，僅測試關鍵流程
- 不要在整合測試中 mock 資料庫或 HTTP 請求
- 使用獨立的測試資料庫，避免影響開發資料庫
- 確保測試資料的一致性和可重現性
