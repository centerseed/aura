# Zentropy Next.js 內部架構職責分離

**版本**: 1.0
**狀態**: Draft
**日期**: 2026-01-30
**作者**: Architecture Team

---

## 1. 執行摘要

本文件定義 Zentropy 在 **Next.js 全棧架構**下的前後端職責分離策略。核心目標是在不引入額外微服務的前提下，透過 **Clean Architecture** 實現清晰的分層與職責邊界。

### 1.1 設計原則

```
✅ 保持技術棧統一（TypeScript/Next.js）
✅ 在 Next.js 內部實現 Clean Architecture 分層
✅ 前端（React Components）與後端（API Routes）職責分離
✅ 未來可輕鬆抽離成獨立微服務（特別是 AI Services）
```

### 1.2 架構演進路徑

```
Phase 1 (現在):
Next.js Monolith → Next.js Clean Architecture
                    (內部分層但不分服務)

Phase 2 (未來):
Next.js Clean Arch → Next.js (UI) + Python/Node AI Service
                    (Librarian 獨立)
```

---

## 2. 現況分析

### 2.1 目前問題

查看現有 API Routes（如 `web/app/api/tasks/route.ts`）發現：

**❌ 問題 1: 邏輯混雜**
```typescript
// API Route 直接混雜：認證 + 查詢 + 格式轉換
export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request, prisma);  // 認證
  const tasks = await prisma.task.findMany({ ... });         // 資料查詢
  const formattedTasks = tasks.map(...);                     // 格式轉換
  return NextResponse.json(formattedTasks);                  // 回應
}
```

**❌ 問題 2: 無統一回應格式**
```typescript
// 成功：直接返回資料
return NextResponse.json(formattedTasks);

// 失敗：格式不一致
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
return NextResponse.json({ error: "Failed...", details: ... }, { status: 500 });
```

**❌ 問題 3: 重複代碼**
- 每個 API Route 都重複認證邏輯
- 格式轉換邏輯散佈各處
- 錯誤處理方式不一致

### 2.2 已有的 Clean Architecture 基礎

專案已有分層目錄，但**未被 API Routes 使用**：

```
web/
├── application/        ✅ 已存在但使用不足
│   ├── use-cases/      (只有 merge-references.ts)
│   ├── hooks/
│   └── contexts/
├── domain/             ✅ 已存在
│   ├── entities/
│   ├── value-objects/
│   └── constants/
└── infrastructure/     ✅ 已存在
    └── (Prisma, Firebase)
```

---

## 3. 目標架構

### 3.1 分層模型

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Presentation Layer (Frontend)                         │ │
│  │  - app/dashboard/*, app/settings/*, etc.               │ │
│  │  - components/                                          │ │
│  │  - React Hooks (useQuery, useMutation)                 │ │
│  │  - lib/api-client.ts (呼叫後端 API)                     │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │ HTTP (Internal)                    │
│  ┌──────────────────────┴─────────────────────────────────┐ │
│  │  Interface Layer (Backend API)                         │ │
│  │  - app/api/*/route.ts (薄薄一層,只做路由轉換)            │ │
│  │  - 驗證 JWT                                             │ │
│  │  - 呼叫 Use Cases                                       │ │
│  │  - 統一回應格式                                          │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴─────────────────────────────────┐ │
│  │  Application Layer (Use Cases)                         │ │
│  │  - application/use-cases/tasks/get-tasks.ts            │ │
│  │  - application/use-cases/tasks/update-task.ts          │ │
│  │  - 業務邏輯編排                                          │ │
│  │  - 與 Domain Entities 協作                              │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴─────────────────────────────────┐ │
│  │  Domain Layer (Business Logic)                         │ │
│  │  - domain/entities/task.ts                             │ │
│  │  - domain/value-objects/                               │ │
│  │  - 純業務邏輯,無框架依賴                                 │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴─────────────────────────────────┐ │
│  │  Infrastructure Layer (External Services)              │ │
│  │  - infrastructure/repositories/task-repository.ts      │ │
│  │  - infrastructure/gemini-client.ts                     │ │
│  │  - lib/db.ts (Prisma), lib/firebase-admin.ts          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└───────────────────────┬──────────────────────────────────────┘
                        │
           ┌────────────┴────────────┐
           │   External Services     │
           ├─────────────────────────┤
           │  Supabase (PostgreSQL)  │
           │  Firebase Auth          │
           │  Gemini API             │
           └─────────────────────────┘
```

### 3.2 職責定義

#### 🎨 Presentation Layer (Frontend)

**位置**: `app/`, `components/`

**職責**:
- ✅ 渲染 UI 與用戶互動
- ✅ 客戶端表單驗證
- ✅ 本地狀態管理（React Query）
- ✅ 透過 `lib/api-client.ts` 呼叫後端 API

**禁止**:
- ❌ 直接操作資料庫（Prisma）
- ❌ 直接呼叫 Gemini API
- ❌ 實作複雜業務邏輯

**範例**:
```typescript
// app/dashboard/components/task-list.tsx
import { apiClient } from '@/lib/api-client'

export function TaskList() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: () => apiClient.tasks.list({ status: 'ACTIVE' })
  })

  return <div>{/* 渲染 UI */}</div>
}
```

---

#### 🔌 Interface Layer (API Routes)

**位置**: `app/api/*/route.ts`

**職責**:
- ✅ HTTP 請求/回應轉換
- ✅ JWT 認證（透過 Middleware）
- ✅ 呼叫 Use Cases
- ✅ 統一回應格式（`ApiResponse<T>`）

**禁止**:
- ❌ 直接操作資料庫
- ❌ 實作業務邏輯

**範例**:
```typescript
// app/api/tasks/route.ts
import { authenticateRequest } from '@/lib/auth-middleware'
import { GetTasksUseCase } from '@/application/use-cases/tasks/get-tasks'
import { ApiResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request)
    const { searchParams } = new URL(request.url)

    const useCase = new GetTasksUseCase()
    const tasks = await useCase.execute({
      userId,
      status: searchParams.get('status'),
      completedToday: searchParams.get('completed_today') === 'true'
    })

    return ApiResponse.success(tasks)
  } catch (error) {
    return ApiResponse.error(error)
  }
}
```

---

#### 🧠 Application Layer (Use Cases)

**位置**: `application/use-cases/`

**職責**:
- ✅ 業務工作流編排
- ✅ 協調多個 Repository
- ✅ 呼叫 Domain Entities
- ✅ 事務管理

**禁止**:
- ❌ 直接處理 HTTP 請求
- ❌ 知道 Prisma 實作細節（透過 Repository Interface）

**範例**:
```typescript
// application/use-cases/tasks/get-tasks.ts
import { TaskRepository } from '@/domain/interfaces/task-repository'
import { Task } from '@/domain/entities/task'

export class GetTasksUseCase {
  constructor(
    private taskRepo: TaskRepository = new PrismaTaskRepository()
  ) {}

  async execute(params: {
    userId: string
    status?: string
    completedToday?: boolean
  }): Promise<Task[]> {
    // 業務邏輯：建立查詢條件
    const filters = this.buildFilters(params)

    // 透過 Repository 查詢
    const tasks = await this.taskRepo.findMany(filters)

    // 業務規則：排序、過濾等
    return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  private buildFilters(params) { /* ... */ }
}
```

---

#### 🔵 Domain Layer (Core Business)

**位置**: `domain/entities/`, `domain/value-objects/`

**職責**:
- ✅ 核心業務規則
- ✅ 數據模型與驗證
- ✅ 領域事件

**禁止**:
- ❌ 任何框架依賴（Next.js, Prisma, etc.）
- ❌ 知道外部服務

**範例**:
```typescript
// domain/entities/task.ts
export class Task {
  constructor(
    public id: string,
    public content: string,
    public status: TaskStatus,
    public productId: string,
    public userId: string,
    public updatedAt: Date
  ) {}

  // 業務規則：只有 INBOX 狀態的任務可以合併
  canMergeWith(other: Task): boolean {
    return this.status === TaskStatus.INBOX &&
           other.status === TaskStatus.INBOX &&
           this.userId === other.userId
  }

  // 業務規則：移至 ARCHIVE 時需要設定完成時間
  archive(): void {
    if (this.status === TaskStatus.ARCHIVE) {
      throw new Error('Task already archived')
    }
    this.status = TaskStatus.ARCHIVE
    this.updatedAt = new Date()
  }
}
```

---

#### 🔴 Infrastructure Layer (External)

**位置**: `infrastructure/repositories/`, `lib/`

**職責**:
- ✅ 實作 Repository Interface
- ✅ Prisma 查詢
- ✅ 外部 API 整合（Gemini, Firebase）

**禁止**:
- ❌ 實作業務邏輯

**範例**:
```typescript
// infrastructure/repositories/prisma-task-repository.ts
import { TaskRepository } from '@/domain/interfaces/task-repository'
import { Task } from '@/domain/entities/task'
import { prisma } from '@/lib/db'

export class PrismaTaskRepository implements TaskRepository {
  async findMany(filters: TaskFilters): Promise<Task[]> {
    const records = await prisma.task.findMany({
      where: this.buildWhereClause(filters),
      include: { product: { include: { area: true } }, topic: true }
    })

    // 將 Prisma Model 轉換為 Domain Entity
    return records.map(r => this.toDomain(r))
  }

  private toDomain(record: PrismaTask): Task {
    return new Task(
      record.id,
      record.content,
      record.status,
      record.product_id,
      record.user_id,
      record.updated_at
    )
  }
}
```

---

## 4. 統一 API 規範

### 4.1 API Response 格式

所有 API 必須使用統一的回應格式:

```typescript
// lib/api-response.ts

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: {
    timestamp: string
    page?: number
    totalPages?: number
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: {
    timestamp: string
    requestId?: string
  }
}

export class ApiResponse {
  static success<T>(data: T, meta?: object): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    })
  }

  static error(
    error: unknown,
    code: string = 'INTERNAL_ERROR',
    status: number = 500
  ): NextResponse<ApiErrorResponse> {
    const message = error instanceof Error ? error.message : String(error)

    return NextResponse.json({
      success: false,
      error: {
        code,
        message,
        details: error
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    }, { status })
  }
}
```

### 4.2 錯誤代碼規範

| Code | HTTP Status | 說明 |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | 參數驗證失敗 |
| `UNAUTHORIZED` | 401 | 未認證或 Token 無效 |
| `FORBIDDEN` | 403 | 無權限 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `CONFLICT` | 409 | 資源衝突（如重複創建） |
| `BUSINESS_LOGIC_ERROR` | 422 | 業務規則不允許 |
| `INTERNAL_ERROR` | 500 | 內部錯誤 |
| `SERVICE_UNAVAILABLE` | 503 | 外部服務不可用 |

---

## 5. Frontend API Client

### 5.1 設計目標

- ✅ 類型安全（TypeScript）
- ✅ 統一錯誤處理
- ✅ 自動附加 JWT Token
- ✅ 與 React Query 整合

### 5.2 實作範例

```typescript
// lib/api-client.ts

import { getAuth } from 'firebase/auth'

class ZentropyAPIClient {
  private baseURL = '/api'

  private async getAuthHeaders() {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const token = await user.getIdToken()
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options?.headers }
    })

    const json = await res.json()

    if (!json.success) {
      throw new APIError(json.error.code, json.error.message)
    }

    return json.data
  }

  // Tasks API
  tasks = {
    list: (filters?: { status?: string, completedToday?: boolean }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.completedToday) params.set('completed_today', 'true')

      return this.request<Task[]>(`/tasks?${params}`)
    },

    update: (taskId: string, data: Partial<Task>) => {
      return this.request<Task>(`/tasks`, {
        method: 'PATCH',
        body: JSON.stringify({ taskId, ...data })
      })
    },

    delete: (taskId: string) => {
      return this.request<void>(`/tasks/${taskId}`, { method: 'DELETE' })
    }
  }

  // Products API
  products = {
    list: () => this.request<Product[]>('/products'),
    create: (data: CreateProductDTO) =>
      this.request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  }
}

export const apiClient = new ZentropyAPIClient()

export class APIError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}
```

### 5.3 React Query 整合

```typescript
// components/task-list.tsx

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function TaskList() {
  const queryClient = useQueryClient()

  // 查詢
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: () => apiClient.tasks.list({ status: 'ACTIVE' })
  })

  // 更新
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Task> }) =>
      apiClient.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  return <div>{/* UI */}</div>
}
```

---

## 6. 實施計畫

### 6.1 Phase 1: 建立基礎設施 (Week 1)

- [ ] **Task 1.1**: 建立 `lib/api-response.ts` (統一回應格式)
- [ ] **Task 1.2**: 建立 `lib/api-client.ts` (Frontend API Client)
- [ ] **Task 1.3**: 建立 `domain/interfaces/task-repository.ts` (Interface)
- [ ] **Task 1.4**: 建立 `infrastructure/repositories/prisma-task-repository.ts`

### 6.2 Phase 2: 重構範例 API (Week 1-2)

- [ ] **Task 2.1**: 重構 `/api/tasks` (GET + PATCH)
  - 建立 `application/use-cases/tasks/get-tasks.ts`
  - 建立 `application/use-cases/tasks/update-task.ts`
  - 更新 `app/api/tasks/route.ts` 使用 Use Cases
- [ ] **Task 2.2**: 更新 Frontend 使用 `apiClient.tasks.*`
- [ ] **Task 2.3**: 撰寫單元測試與整合測試

### 6.3 Phase 3: 逐步遷移其他 API (Week 2-3)

按以下順序遷移:
1. `/api/me` (簡單)
2. `/api/areas`, `/api/products` (中等)
3. `/api/brain-dump`, `/api/reorganize` (複雜,涉及 AI)

### 6.4 Phase 4: AI Services 整合 (Week 4+)

- [ ] 實作 Librarian Engine (JS 版本)
- [ ] 整合 Gatekeeper、Coach
- [ ] 考慮是否獨立成 Microservice

---

## 7. 遷移策略

### 7.1 雙軌並行 (Parallel Run)

```
舊 API Route (保留) ←─┐
                      ├─→ Frontend (可選擇呼叫哪個)
新 API Route (重構) ←─┘
```

**步驟**:
1. 新增 `/api/v2/tasks` (重構版)
2. Frontend 逐步切換到 v2
3. 觀察錯誤率與效能
4. 確認穩定後刪除舊版

### 7.2 Feature Flag

```typescript
// lib/feature-flags.ts
export const USE_NEW_API = process.env.NEXT_PUBLIC_USE_NEW_API === 'true'

// Frontend
const endpoint = USE_NEW_API ? '/api/v2/tasks' : '/api/tasks'
```

---

## 8. 測試策略

### 8.1 單元測試 (Domain & Application)

```typescript
// application/use-cases/tasks/get-tasks.test.ts

import { GetTasksUseCase } from './get-tasks'
import { MockTaskRepository } from '@/tests/mocks/task-repository'

describe('GetTasksUseCase', () => {
  it('should filter tasks by status', async () => {
    const mockRepo = new MockTaskRepository()
    const useCase = new GetTasksUseCase(mockRepo)

    const tasks = await useCase.execute({
      userId: 'user123',
      status: 'ACTIVE'
    })

    expect(tasks).toHaveLength(2)
    expect(tasks.every(t => t.status === 'ACTIVE')).toBe(true)
  })
})
```

### 8.2 整合測試 (API Routes)

```typescript
// tests/integration/api/tasks.test.ts

import { GET } from '@/app/api/tasks/route'
import { NextRequest } from 'next/server'

describe('GET /api/tasks', () => {
  it('should return tasks for authenticated user', async () => {
    const request = new NextRequest('http://localhost/api/tasks', {
      headers: { 'Authorization': `Bearer ${validToken}` }
    })

    const response = await GET(request)
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.data).toBeInstanceOf(Array)
  })
})
```

---

## 9. 成功指標

| 指標 | 目標 | 測量方式 |
|------|------|----------|
| **代碼重複率** | <10% | SonarQube |
| **測試覆蓋率** | >80% | Vitest Coverage |
| **API 回應一致性** | 100% | 人工檢查 |
| **類型安全性** | 0 `any` | TypeScript Strict Mode |

---

## 10. 文件結構（更新後）

```
web/
├── app/
│   ├── api/                    # 🔌 Interface Layer
│   │   ├── tasks/
│   │   │   └── route.ts        # 薄層,呼叫 Use Cases
│   │   └── products/
│   │       └── route.ts
│   ├── dashboard/              # 🎨 Presentation Layer
│   └── settings/
│
├── application/                # 🧠 Application Layer
│   └── use-cases/
│       ├── tasks/
│       │   ├── get-tasks.ts
│       │   ├── update-task.ts
│       │   └── merge-tasks.ts
│       └── products/
│           └── reorganize-topics.ts
│
├── domain/                     # 🔵 Domain Layer
│   ├── entities/
│   │   ├── task.ts
│   │   ├── product.ts
│   │   └── area.ts
│   ├── value-objects/
│   │   ├── task-status.ts
│   │   └── lifecycle.ts
│   └── interfaces/
│       ├── task-repository.ts
│       └── product-repository.ts
│
├── infrastructure/             # 🔴 Infrastructure Layer
│   └── repositories/
│       ├── prisma-task-repository.ts
│       └── prisma-product-repository.ts
│
├── lib/
│   ├── api-response.ts         # 統一回應格式
│   ├── api-client.ts           # Frontend API Client
│   ├── auth-middleware.ts
│   └── db.ts                   # Prisma Client
│
└── tests/
    ├── unit/
    ├── integration/
    └── mocks/
```

---

## 11. 參考文件

- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Next.js API Routes Best Practices](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [002_Software_Engineering_Standards.md](../06_Standards/002_Software_Engineering_Standards.md)

---

**文件結束** | 如有疑問請聯繫 Architecture Team
