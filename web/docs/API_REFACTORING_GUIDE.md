# API 重構指南

本文檔說明如何將現有 API 端點重構為 Clean Architecture 模式。

## 重構模式

### 1. 建立 Use Case

**位置**: `web/application/use-cases/{domain}/{action}.ts`

```typescript
// 範例: CreateProductUseCase
import type { IProductRepository } from '@/domain/interfaces/product-repository'
import { PrismaProductRepository } from '@/infrastructure/repositories/prisma-product-repository'

export interface CreateProductRequest {
  userId: string
  name: string
  areaId: string
  // ... 其他欄位
}

export interface CreateProductResponse {
  product: ProductData
  message: string
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: IProductRepository = new PrismaProductRepository()
  ) {}

  async execute(request: CreateProductRequest): Promise<CreateProductResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 建立資料
    const product = await this.productRepository.create({
      userId: request.userId,
      name: request.name,
      areaId: request.areaId,
      // ...
    })

    return {
      product,
      message: 'Product created successfully',
    }
  }

  private validateRequest(request: CreateProductRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationException('Product name is required', 'name')
    }
    // ... 其他驗證
  }
}
```

### 2. 重構 API Route

**模式**: 使用 `catchDomainException` + Use Case + `ApiResponseBuilder`

```typescript
import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { CreateProductUseCase } from '@/application/use-cases/products/create-product'
import { formatProductForFrontend } from '@/lib/api-format-helpers'

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析請求體
    const body = await request.json()
    const { name, area_id } = body

    // 3. 基礎驗證
    if (!name) {
      return ApiResponseBuilder.validationError('name is required', {
        field: 'name',
      })
    }

    // 4. 執行 Use Case
    const useCase = new CreateProductUseCase()
    const result = await useCase.execute({
      userId,
      name,
      areaId: area_id,
    })

    // 5. 格式化回應 (使用 helper)
    const formattedProduct = formatProductForFrontend(result.product)

    // 6. 統一回應格式
    return ApiResponseBuilder.success(
      {
        product: formattedProduct,
        message: result.message,
      },
      {}
    )
  })
}
```

### 3. 使用格式化 Helper

**位置**: `web/lib/api-format-helpers.ts`

```typescript
import { formatTaskForFrontend } from '@/lib/api-format-helpers'

// 單個任務
const formattedTask = formatTaskForFrontend(task)

// 批量任務
const formattedTasks = formatTasksForFrontend(tasks)
```

## 統一 API 回應格式

### 成功回應

```typescript
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-30T...",
    "total": 100,      // 可選
    "filtered": 10     // 可選
  }
}
```

### 錯誤回應

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" | ...,
    "message": "錯誤訊息",
    "details": { ... }  // 可選
  },
  "meta": {
    "timestamp": "2024-01-30T..."
  }
}
```

## 常用錯誤處理

```typescript
// 驗證錯誤
return ApiResponseBuilder.validationError('Field is required', {
  field: 'fieldName',
})

// 未認證
return ApiResponseBuilder.unauthorized()

// 404 Not Found (自動處理)
throw new NotFoundException('Resource')

// 衝突錯誤
throw new ConflictException('Resource already exists')
```

## 重構檢查清單

### Use Case 層
- [ ] 建立 Use Case class
- [ ] 定義 Request/Response DTOs
- [ ] 實作 execute() 方法
- [ ] 加入輸入驗證 (validateRequest)
- [ ] 加入業務規則驗證
- [ ] 使用 Repository 存取資料
- [ ] 拋出 Domain Exceptions

### API Route 層
- [ ] 使用 catchDomainException 包裹
- [ ] 認證檢查 (authenticateRequest)
- [ ] 解析請求參數/body
- [ ] 基礎驗證
- [ ] 呼叫 Use Case
- [ ] 使用 formatHelper 格式化回應
- [ ] 使用 ApiResponseBuilder 統一格式

### 測試層
- [ ] 更新測試檔案
- [ ] 驗證 `json.success` 屬性
- [ ] 驗證 `json.data` 結構
- [ ] 驗證 `json.error.code` (錯誤情況)
- [ ] 更新 import 為相對路徑 (如需要)
- [ ] 執行測試確保通過

## 已重構端點

✅ **Tasks API** (4/11)
- GET /api/tasks
- POST /api/tasks
- PATCH /api/tasks
- GET /api/tasks/[taskId]
- DELETE /api/tasks/[taskId]

## 待重構端點 (23個)

### Tasks 子資源 (5個)
- [ ] POST /api/tasks/[taskId]/references
- [ ] DELETE /api/tasks/[taskId]/references
- [ ] DELETE /api/tasks/[taskId]/references/[referenceId]
- [ ] POST /api/tasks/[taskId]/sub-items
- [ ] PATCH /api/tasks/[taskId]/sub-items/[subItemId]
- [ ] DELETE /api/tasks/[taskId]/sub-items/[subItemId]
- [ ] POST /api/tasks/[taskId]/merge-into

### Products API (7個)
- [ ] GET /api/products
- [ ] POST /api/products
- [ ] GET /api/products/[id]
- [ ] PATCH /api/products/[id]
- [ ] DELETE /api/products/[id]
- [ ] POST /api/products/[id]/references
- [ ] POST /api/products/reorder

### Areas API (2個)
- [ ] GET /api/areas
- [ ] POST /api/areas
- [ ] PATCH /api/areas/[id]
- [ ] DELETE /api/areas/[id]

### Milestones API (2個)
- [ ] GET /api/milestones
- [ ] POST /api/milestones
- [ ] PATCH /api/milestones/[id]
- [ ] DELETE /api/milestones/[id]

### AI 功能 API (5個)
- [ ] POST /api/brain-dump
- [ ] POST /api/library
- [ ] POST /api/reorganize
- [ ] POST /api/suggest-product
- [ ] POST /api/adjust-tags

### 其他 API (4個)
- [ ] POST /api/auth/signin
- [ ] GET /api/me
- [ ] POST /api/users
- [ ] POST /api/evaluation/logs

## 快速重構腳本範例

```bash
# 1. 建立 Use Case
mkdir -p web/application/use-cases/products
touch web/application/use-cases/products/create-product.ts

# 2. 實作 Use Case (參考上方模式)

# 3. 重構 API Route (參考上方模式)

# 4. 執行測試
npx vitest run tests/integration/api/products.test.ts
```

## 參考資料

- [ApiResponseBuilder 文檔](web/lib/api-response.ts)
- [API Format Helpers](web/lib/api-format-helpers.ts)
- [Domain Exceptions](web/lib/api-response.ts#L15-L50)
- [已重構範例](web/app/api/tasks/route.ts)
