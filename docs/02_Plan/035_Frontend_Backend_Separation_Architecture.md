# Zentropy 前後端分離架構規劃

**版本**: 1.0
**狀態**: Draft
**日期**: 2026-01-30
**作者**: Architecture Team

---

## 1. 執行摘要 (Executive Summary)

本文件定義 Zentropy 系統從目前的 **Monolithic Next.js 應用**過渡到 **前後端分離架構**的完整規劃。核心目標是將 AI 協作、業務邏輯、資料治理等複雜功能移至獨立的 Backend 服務,讓 Frontend 專注於提供優秀的用戶體驗。

### 1.1 架構演進路徑

```
Current State (Phase 0)          →  Target State (Phase 2)
┌─────────────────────────────┐     ┌──────────────────────────┐
│   Next.js Monolith          │     │   Multi-Service Arch     │
│  ┌────────┬──────────────┐  │     │  ┌────────┬──────────┐  │
│  │ UI/UX  │  API Routes  │  │     │  │Frontend│ Backend  │  │
│  │        │   (混合)     │  │     │  │(Pure UI│(AI+Logic)│  │
│  └────────┴──────────────┘  │     │  └────────┴──────────┘  │
│          ↓                   │     │       ↓         ↓       │
│      Supabase/Postgres       │     │   Supabase  PostgreSQL  │
└─────────────────────────────┘     └──────────────────────────┘
```

---

## 2. 現況分析 (Current State Analysis)

### 2.1 現有架構

#### A. Web Application (`web/`)
- **技術棧**: Next.js 16 + React 19
- **架構模式**: Clean Architecture (部分實作)
  ```
  web/
  ├── app/              # Next.js App Router (UI + API)
  ├── components/       # React 元件
  ├── application/      # Use Cases (業務邏輯)
  ├── domain/           # 領域模型
  ├── infrastructure/   # Prisma, Firebase Client
  └── lib/              # 工具函式
  ```
- **資料層**: Prisma ORM → Supabase (PostgreSQL)
- **AI 整合**: `@ai-sdk/google` (Gemini) 直接在 Frontend 呼叫

#### B. Mobile Application (`app/`)
- **技術棧**: Flutter
- **資料來源**: 直接連接 Supabase (尚未整合統一 API)

#### C. 資料庫
- **主資料庫**: Supabase (PostgreSQL)
- **認證**: Supabase Auth
- **即時功能**: Supabase Realtime

### 2.2 當前痛點

| 問題 | 影響 | 嚴重程度 |
|------|------|----------|
| **邏輯混雜** | UI 與 AI 邏輯耦合,難以測試 | 🔴 High |
| **多端重複** | Web/Mobile 需各自實作業務邏輯 | 🟡 Medium |
| **擴展困難** | AI Agent 協作無獨立服務 | 🔴 High |
| **效能瓶頸** | LLM 呼叫阻塞 UI 渲染 | 🟡 Medium |
| **安全風險** | API Key 暴露於 Client Side | 🟠 Medium-High |

---

## 3. 目標架構 (Target Architecture)

### 3.1 架構藍圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
├──────────────────────────────┬──────────────────────────────────────┤
│   Web Frontend (Next.js)     │   Mobile App (Flutter)               │
│   - React UI Components      │   - Material Design UI               │
│   - Local State (React Query)│   - Riverpod State Management        │
│   - Client-side Validation   │   - Offline-first Cache              │
└──────────────┬───────────────┴───────────────┬──────────────────────┘
               │                               │
               │       HTTPS/JSON REST API     │
               │                               │
┌──────────────┴───────────────────────────────┴──────────────────────┐
│                     API Gateway / BFF Layer                          │
│  (可選: Next.js API Routes 或 獨立 GraphQL/tRPC Gateway)             │
└──────────────┬───────────────────────────────┬──────────────────────┘
               │                               │
┌──────────────┴───────────────┐ ┌────────────┴──────────────────────┐
│   Core Backend Services      │ │   AI/Governance Services          │
│   (FastAPI/Python)           │ │   (FastAPI/Python)                │
│                              │ │                                   │
│ ┌──────────────────────────┐ │ │ ┌───────────────────────────────┐│
│ │ User Service             │ │ │ │ Gatekeeper Agent              ││
│ │ - Authentication         │ │ │ │ - NLU Ingestion               ││
│ │ - Profile Management     │ │ │ │ - Risk Detection              ││
│ └──────────────────────────┘ │ │ └───────────────────────────────┘│
│                              │ │                                   │
│ ┌──────────────────────────┐ │ │ ┌───────────────────────────────┐│
│ │ Entity Service           │ │ │ │ Librarian Agent               ││
│ │ - Area/Product/Topic     │ │ │ │ - Memory Distillation         ││
│ │ - Vault File Management  │ │ │ │ - Auto-Classification         ││
│ └──────────────────────────┘ │ │ │ - Tag Renovation              ││
│                              │ │ └───────────────────────────────┘│
│ ┌──────────────────────────┐ │ │                                   │
│ │ Task Service             │ │ │ ┌───────────────────────────────┐│
│ │ - CRUD Operations        │ │ │ │ Coach Agent                   ││
│ │ - Status Transition      │ │ │ │ - Conflict Detection          ││
│ └──────────────────────────┘ │ │ │ - Daily Briefings             ││
│                              │ │ │ - Approval Workflow           ││
└──────────────┬───────────────┘ │ └───────────────────────────────┘│
               │                 │                                   │
               │                 └─────────────┬─────────────────────┘
               │                               │
┌──────────────┴───────────────────────────────┴──────────────────────┐
│                     Data Layer                                       │
├──────────────────────────────┬───────────────────────────────────────┤
│  Primary DB (Supabase)       │  AI Memory Store (PostgreSQL+Vector) │
│  - Users, Tasks, Entities    │  - Correction Logs                   │
│  - Realtime Subscriptions    │  - Distilled Rules                   │
│                              │  - pgvector for RAG                  │
└──────────────────────────────┴───────────────────────────────────────┘
```

### 3.2 服務邊界定義

#### 🎨 Frontend Services (Web + Mobile)

**職責 (What to DO)**:
- ✅ 渲染 UI 與用戶互動
- ✅ Client-side Validation (快速反饋)
- ✅ 本地狀態管理 (React Query/Riverpod)
- ✅ 樂觀更新 (Optimistic Updates)
- ✅ 路由與導航

**禁止 (What NOT to DO)**:
- ❌ 直接呼叫 LLM API
- ❌ 實作複雜業務邏輯
- ❌ 直接操作資料庫
- ❌ 存儲敏感 API Key

#### ⚙️ Core Backend Services

**職責**:
- ✅ 資料的 CRUD 操作
- ✅ 業務規則驗證
- ✅ 權限控制 (Authorization)
- ✅ 資料一致性維護
- ✅ 與 Supabase 整合

**API 範例**:
```
POST   /api/v1/tasks              # 創建任務
GET    /api/v1/tasks/:id          # 獲取任務
PATCH  /api/v1/tasks/:id          # 更新任務
DELETE /api/v1/tasks/:id          # 刪除任務

GET    /api/v1/entities/areas     # 獲取 Areas
POST   /api/v1/entities/products  # 創建 Product
```

#### 🤖 AI/Governance Services

**職責**:
- ✅ NLU 解析 (Gatekeeper)
- ✅ 自動分類與歸檔 (Librarian)
- ✅ 衝突偵測與建議 (Coach)
- ✅ 記憶蒸餾與 RAG
- ✅ LLM 協作編排

**API 範例**:
```
POST   /api/v1/agents/gatekeeper/ingest    # 接收原始輸入
POST   /api/v1/agents/librarian/classify   # 自動分類
GET    /api/v1/agents/librarian/suggest    # 獲取歸檔建議
POST   /api/v1/agents/coach/detect-conflicts  # 檢測衝突
GET    /api/v1/agents/coach/briefing       # 獲取晨/晚報
```

---

## 4. API 設計規範

### 4.1 RESTful API 標準

#### 命名慣例
```
# Resource-Oriented Design
GET    /api/v1/resources           # 列表
GET    /api/v1/resources/:id       # 單一資源
POST   /api/v1/resources           # 創建
PATCH  /api/v1/resources/:id       # 部分更新
PUT    /api/v1/resources/:id       # 完整更新
DELETE /api/v1/resources/:id       # 刪除

# Nested Resources (避免超過 2 層)
GET    /api/v1/areas/:areaId/products

# Actions (非 CRUD 操作)
POST   /api/v1/tasks/:id/complete
POST   /api/v1/tasks/:id/archive
```

#### 統一回應格式

**成功回應**:
```json
{
  "success": true,
  "data": {
    "id": "task_123",
    "title": "完成架構規劃",
    "status": "active"
  },
  "meta": {
    "timestamp": "2026-01-30T10:00:00Z"
  }
}
```

**錯誤回應**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Task title is required",
    "details": {
      "field": "title",
      "constraint": "minLength"
    }
  },
  "meta": {
    "timestamp": "2026-01-30T10:00:00Z",
    "requestId": "req_abc123"
  }
}
```

#### HTTP 狀態碼規範

| 狀態碼 | 情境 | 說明 |
|--------|------|------|
| `200 OK` | 成功 | GET/PATCH/DELETE 成功 |
| `201 Created` | 創建成功 | POST 創建資源成功 |
| `204 No Content` | 刪除成功 | DELETE 成功且無返回內容 |
| `400 Bad Request` | 請求錯誤 | 驗證失敗、參數錯誤 |
| `401 Unauthorized` | 未認證 | 缺少或無效的 Token |
| `403 Forbidden` | 無權限 | 已認證但無存取權限 |
| `404 Not Found` | 資源不存在 | 資源 ID 無效 |
| `409 Conflict` | 衝突 | 資源狀態衝突 |
| `422 Unprocessable Entity` | 業務邏輯錯誤 | 資料格式正確但業務規則不允許 |
| `500 Internal Server Error` | 伺服器錯誤 | 未預期的錯誤 |
| `503 Service Unavailable` | 服務不可用 | LLM API 超時、資料庫連線失敗 |

### 4.2 認證與授權

#### 認證流程 (Supabase Auth)

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│ Frontend │                │ Backend  │                │ Supabase │
└─────┬────┘                └────┬─────┘                └────┬─────┘
      │                          │                           │
      │ 1. Login (email/pw)      │                           │
      ├─────────────────────────────────────────────────────>│
      │                          │      2. JWT Token         │
      │<──────────────────────────────────────────────────────┤
      │                          │                           │
      │ 3. API Call + Bearer Token                           │
      ├─────────────────────────>│                           │
      │                          │ 4. Verify Token           │
      │                          ├──────────────────────────>│
      │                          │ 5. User Info              │
      │                          │<───────────────────────────┤
      │                          │ 6. Check Permissions      │
      │                          │ (內部邏輯)                 │
      │      7. Response         │                           │
      │<─────────────────────────┤                           │
```

#### Authorization Header
```http
GET /api/v1/tasks HTTP/1.1
Host: api.zentropy.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.3 分頁與過濾

#### 分頁參數
```
GET /api/v1/tasks?page=1&limit=20&sort=-createdAt

Response:
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

#### 過濾參數
```
# 基礎過濾
GET /api/v1/tasks?status=active&priority=high

# 日期範圍
GET /api/v1/tasks?createdAt[gte]=2026-01-01&createdAt[lte]=2026-01-31

# 搜尋
GET /api/v1/tasks?q=架構設計
```

---

## 5. 資料流設計

### 5.1 同步操作流程 (Synchronous Flow)

**範例: 用戶創建任務**

```
User Action: "點擊新增任務按鈕"
     │
     ├─> Frontend: 顯示表單
     │
User Action: "填寫並提交表單"
     │
     ├─> Frontend: Client-side Validation
     │       ├─ ✅ 通過 → 發送 API 請求
     │       └─ ❌ 失敗 → 顯示錯誤訊息
     │
     ├─> Backend: POST /api/v1/tasks
     │       ├─ 1. 驗證 JWT Token
     │       ├─ 2. 業務邏輯驗證
     │       ├─ 3. 寫入資料庫 (Supabase)
     │       ├─ 4. 回傳結果
     │       └─ 5. (可選) 觸發非同步事件
     │
     └─> Frontend:
            ├─ 更新本地狀態 (React Query Cache)
            ├─ 顯示成功訊息
            └─ 導航至任務詳情頁
```

### 5.2 非同步操作流程 (Asynchronous Flow)

**範例: Librarian 自動分類**

```
Trigger: "Gatekeeper 接收到新輸入"
     │
     ├─> Frontend: 顯示 "處理中..." 狀態
     │
     ├─> Backend: POST /api/v1/agents/gatekeeper/ingest
     │       ├─ 1. 儲存原始輸入
     │       ├─ 2. 回傳 202 Accepted + Job ID
     │       └─ 3. 觸發 Background Job
     │
     ├─> Frontend: 輪詢或 WebSocket 監聽結果
     │
     └─> Background Job (Celery/RQ):
            ├─ 4. 呼叫 Librarian Service
            │     ├─ RAG 檢索相關規則
            │     ├─ LLM 分類
            │     └─ 產生建議
            ├─ 5. 更新資料庫 (狀態改為 "completed")
            └─ 6. 發送 WebSocket 事件 / Webhook
                   │
                   └─> Frontend: 接收結果並更新 UI
```

### 5.3 即時協作 (Real-time Collaboration)

**使用 Supabase Realtime**:

```typescript
// Frontend: 訂閱任務更新
const taskSubscription = supabase
  .channel('tasks')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      // 更新本地狀態
      queryClient.invalidateQueries(['tasks'])
    }
  )
  .subscribe()
```

---

## 6. 技術棧與工具選擇

### 6.1 Frontend Stack

#### Web (`web/`)
```json
{
  "framework": "Next.js 16+",
  "language": "TypeScript",
  "ui": "React 19 + Tailwind CSS + shadcn/ui",
  "state": "React Query (TanStack Query)",
  "forms": "React Hook Form + Zod",
  "auth": "Supabase Auth",
  "realtime": "Supabase Realtime"
}
```

#### Mobile (`app/`)
```yaml
framework: Flutter 3.x
language: Dart
state: Riverpod
storage: Hive (Offline-first)
auth: Supabase Auth
```

### 6.2 Backend Stack

#### Core Services
```toml
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.115.0"
uvicorn = "^0.34.0"
pydantic = "^2.10.0"
sqlalchemy = {extras = ["asyncio"], version = "^2.0.0"}
asyncpg = "^0.30.0"
supabase = "^2.0.0"
```

#### AI Services (Librarian/Gatekeeper/Coach)
```toml
google-genai = "^1.0.0"      # Gemini LLM
pgvector = "^0.3.0"          # Vector DB
scikit-learn = "^1.6.0"      # Clustering
celery = "^5.4.0"            # Background Jobs
redis = "^5.0.0"             # Task Queue + Cache
```

### 6.3 基礎設施

```yaml
Database:
  Primary: Supabase (PostgreSQL 15+)
  Vector: PostgreSQL + pgvector Extension
  Cache: Redis 7+

Message Queue:
  Jobs: Celery + Redis
  Events: Redis Pub/Sub

Monitoring:
  Logs: Google Cloud Logging
  Metrics: Prometheus + Grafana (未來)
  Tracing: OpenTelemetry (未來)

Deployment:
  Frontend: Vercel
  Backend: Google Cloud Run (Containerized)
  Database: Supabase Cloud
```

---

## 7. 部署架構

### 7.1 Production Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare CDN                            │
│  (DNS + DDoS Protection + SSL Termination)                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
┌────────┴────────┐   ┌───────────┴──────────┐
│  Vercel         │   │  Google Cloud        │
│  ┌───────────┐  │   │  ┌────────────────┐  │
│  │ Next.js   │  │   │  │ Cloud Run      │  │
│  │ Frontend  │  │   │  │ - Core Backend │  │
│  └───────────┘  │   │  │ - AI Services  │  │
└─────────────────┘   │  └────────┬───────┘  │
                      │           │          │
                      │  ┌────────┴───────┐  │
                      │  │ Redis (Memorystore)│
                      │  └────────────────┘  │
                      └─────────────────────┘
                               │
                      ┌────────┴─────────┐
                      │ Supabase Cloud   │
                      │ - PostgreSQL     │
                      │ - Auth           │
                      │ - Realtime       │
                      │ - Storage        │
                      └──────────────────┘
```

### 7.2 Container Strategy

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安裝依賴
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-dev

# 複製程式碼
COPY ./src ./src

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:8000/health || exit 1

# 啟動
CMD ["poetry", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 7.3 環境變數管理

```bash
# .env.production (Backend)
DATABASE_URL=postgresql://user:pass@supabase.co:5432/zentropy
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
REDIS_URL=redis://10.x.x.x:6379
GEMINI_API_KEY=AIza...

# Frontend 透過 Next.js 環境變數注入
NEXT_PUBLIC_API_URL=https://api.zentropy.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 8. 遷移策略 (Migration Plan)

### 8.1 Phase 1: 基礎建設 (Week 1-2)

**目標**: 建立 Backend 骨架,不影響現有 Web App

- [ ] 建立 `backend/` 目錄結構 (Clean Architecture)
- [ ] 設定 FastAPI + SQLAlchemy + Prisma Schema 同步
- [ ] 實作 `/health` 和 `/api/v1/users/me` 端點
- [ ] 部署到 Cloud Run (Staging)
- [ ] Frontend 開始遷移第一個 API (Read-only)

### 8.2 Phase 2: Core Services 遷移 (Week 3-4)

**目標**: 將 CRUD 邏輯從 Next.js API Routes 移至 Backend

```
遷移順序 (由簡至繁):
1. User Profile API          (低風險)
2. Areas/Products API        (中風險)
3. Tasks API (Read)          (中風險)
4. Tasks API (Write)         (高風險 - 需要完整測試)
```

**並行策略** (Dual-Write Pattern):
```
Frontend
   ├─> Call Backend API (Primary)
   └─> Fallback to Next.js API (Backup)
```

### 8.3 Phase 3: AI Services 整合 (Week 5-6)

**目標**: 實作 Gatekeeper/Librarian/Coach Agents

- [ ] 實作 Librarian Engine (POC 已規劃,見 `034_Librarian_Engine_POC_Implementation.md`)
- [ ] 整合 Gatekeeper NLU 邏輯
- [ ] 實作 Background Job Queue (Celery)
- [ ] Frontend 整合 AI 輔助功能

### 8.4 Phase 4: 效能優化與監控 (Week 7-8)

- [ ] 設定 Redis Cache
- [ ] 實作 Rate Limiting
- [ ] 加入 APM (Application Performance Monitoring)
- [ ] 壓力測試與調優

---

## 9. 風險與緩解措施

| 風險 | 影響 | 機率 | 緩解措施 |
|------|------|------|----------|
| **雙寫不一致** | 🔴 High | 中 | 使用 Transaction + Idempotency Key |
| **API 延遲增加** | 🟡 Medium | 高 | Redis Cache + CDN + 預載入 |
| **Supabase RLS 衝突** | 🟡 Medium | 中 | Backend 使用 Service Key 繞過 RLS |
| **LLM 成本暴增** | 🟠 Medium-High | 中 | Rate Limiting + Prompt Caching |
| **部署複雜度** | 🟡 Medium | 高 | Docker Compose 本地開發 + CI/CD 自動化 |

---

## 10. 成功指標 (Success Metrics)

### 10.1 技術指標

| 指標 | Baseline | Target | 測量方式 |
|------|----------|--------|----------|
| **API P95 延遲** | N/A | <500ms | APM |
| **首屏載入時間** | ~2s | <1.5s | Lighthouse |
| **Backend 可用性** | N/A | >99.9% | Uptime Monitor |
| **LLM 呼叫成功率** | ~95% | >98% | Error Rate Tracking |

### 10.2 開發體驗指標

- ✅ 本地開發環境設定時間 < 15 分鐘
- ✅ 新 API 端點開發時間 < 4 小時
- ✅ E2E 測試覆蓋率 > 80%

---

## 11. 參考文件

- [001_Backend_Implementation_Plan.md](./001_Backend_Implementation_Plan.md) - Backend 實作細節
- [034_Librarian_Engine_POC_Implementation.md](./034_Librarian_Engine_POC_Implementation.md) - AI Engine 規劃
- [002_Software_Engineering_Standards.md](../06_Standards/002_Software_Engineering_Standards.md) - Clean Architecture 標準
- [REST API Design Best Practices](https://restfulapi.net/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

---

## 12. 附錄

### 12.1 資料夾結構 (完整版)

```
zentropy/
├── web/                          # Next.js Frontend
│   ├── app/                      # App Router
│   ├── components/               # React 元件
│   ├── lib/
│   │   ├── api-client.ts         # 🆕 Backend API Client
│   │   └── supabase.ts           # Supabase Client
│   └── ...
│
├── app/                          # Flutter Mobile
│   └── lib/
│       └── data/
│           └── api_client.dart   # 🆕 Backend API Client
│
├── backend/                      # 🆕 Python Backend
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── docker-compose.yml
│   │
│   ├── src/
│   │   ├── main.py               # FastAPI Entry Point
│   │   │
│   │   ├── core/                 # 核心配置
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   │
│   │   ├── api/                  # API Layer
│   │   │   ├── v1/
│   │   │   │   ├── users.py
│   │   │   │   ├── tasks.py
│   │   │   │   ├── entities.py
│   │   │   │   └── agents.py
│   │   │   └── deps.py           # Dependencies
│   │   │
│   │   ├── domain/               # Domain Layer
│   │   │   ├── entities/
│   │   │   └── interfaces/
│   │   │
│   │   ├── application/          # Application Layer
│   │   │   ├── use_cases/
│   │   │   └── services/
│   │   │
│   │   ├── infrastructure/       # Infrastructure
│   │   │   ├── persistence/
│   │   │   ├── llm/
│   │   │   └── queue/
│   │   │
│   │   └── agents/               # AI Agents
│   │       ├── gatekeeper/
│   │       ├── librarian/
│   │       └── coach/
│   │
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── e2e/
│
└── docs/
    └── 02_Plan/
        └── 035_Frontend_Backend_Separation_Architecture.md  # 本文件
```

### 12.2 API Client 範例 (Frontend)

```typescript
// web/lib/api-client.ts

import { createClient } from '@supabase/supabase-js'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ZentropyAPIClient {
  private supabase = createClient(...)

  private async getAuthHeaders() {
    const { data: { session } } = await this.supabase.auth.getSession()
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  async getTasks(filters?: TaskFilters) {
    const headers = await this.getAuthHeaders()
    const params = new URLSearchParams(filters)

    const res = await fetch(`${API_URL}/api/v1/tasks?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch tasks')

    return res.json()
  }

  async createTask(data: CreateTaskDTO) {
    const headers = await this.getAuthHeaders()

    const res = await fetch(`${API_URL}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    })

    if (!res.ok) throw new Error('Failed to create task')
    return res.json()
  }
}

export const apiClient = new ZentropyAPIClient()
```

---

**文件結束** | 如有疑問請聯繫 Architecture Team
