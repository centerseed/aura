# Zentropy POC 架構升級規劃

> TypeScript 全端架構 + 前後端分離 + AI 使用追蹤系統

**文件版本**: v1.0  
**更新日期**: 2026-01-25

---

## 1. 架構概覽

### 1.1 技術棧升級

| 層級 | 當前 (Web POC) | 升級目標 |
|------|---------------|---------|
| **前端** | Next.js (含 API Routes) | Next.js (純前端 SPA/SSG) |
| **後端 API** | Next.js API Routes | TypeScript Backend (Firebase Functions / Cloud Run) |
| **資料庫** | PostgreSQL (Local) | Supabase (PostgreSQL + Realtime + Auth) |
| **檔案儲存** | N/A | Supabase Storage |
| **託管** | Vercel | Firebase Hosting (前端) + Cloud Run/Functions (後端) |
| **AI/LLM** | @ai-sdk/google | @ai-sdk/google (後端專用) |
| **認證** | Mock User | Supabase Auth (Google OAuth) |

### 1.2 架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (Firebase Hosting)                            │
│  ├── React 18+ / TypeScript                                     │
│  ├── TailwindCSS + shadcn/ui                                    │
│  ├── @dnd-kit (Drag & Drop)                                     │
│  ├── @supabase/supabase-js (Auth + Realtime)                    │
│  └── TanStack Query (API Caching)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  Cloud Run / Firebase Functions (TypeScript)                    │
│  ├── Express.js / Hono.js (API Router)                          │
│  ├── @ai-sdk/google (Gemini Integration)                        │
│  ├── Zod (Schema Validation)                                    │
│  ├── Supabase Client (DB + Auth Verification)                   │
│  └── AI Usage Tracking Service                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ 
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  Supabase                                                       │
│  ├── PostgreSQL (核心資料)                                       │
│  │   ├── Areas / Products / Topics / Tasks                     │
│  │   ├── Milestones / GovernanceProposals                      │
│  │   └── ai_usage_logs (AI 使用追蹤)                             │
│  ├── Auth (Google OAuth)                                        │
│  ├── Realtime (即時同步)                                         │
│  ├── Storage (附件/圖片)                                         │
│  └── Edge Functions (Optional)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 前後端分離架構

### 2.1 前端 (Firebase Hosting)

**專案結構**:
```
zentropy-web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 認證相關頁面
│   │   ├── dashboard/          # 主控台
│   │   └── onboarding/         # 引導流程
│   ├── components/             # UI 組件
│   ├── hooks/                  # Custom Hooks
│   ├── lib/
│   │   ├── api-client.ts       # API Client (Fetch Wrapper)
│   │   ├── supabase.ts         # Supabase Client
│   │   └── auth.ts             # Auth Helpers
│   ├── stores/                 # Zustand/Jotai State
│   └── types/                  # TypeScript Types
├── public/
├── next.config.ts
├── firebase.json               # Firebase Hosting Config
└── package.json
```

**核心配置 (`firebase.json`)**:
```json
{
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
      }
    ]
  }
}
```

**API Client 示例**:
```typescript
// src/lib/api-client.ts
import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 2.2 後端 API (Cloud Run / Firebase Functions)

**選項比較**:

| 特性 | Cloud Run | Firebase Functions (2nd Gen) |
|------|-----------|-------------------------------|
| 冷啟動 | 較快 (Container) | 略慢 |
| 部署單位 | 整個服務 | 單一函數 |
| 語言支援 | 任意 (Docker) | Node.js / Python |
| 自動擴展 | ✅ | ✅ |
| 最低成本 | 可設 min-instances=0 | 免費額度較高 |
| 適用場景 | 複雜 API 服務 | 簡單端點 / Event-driven |

**推薦方案**: **Cloud Run** (適合統一的 API 服務)

**專案結構 (Cloud Run)**:
```
zentropy-api/
├── src/
│   ├── index.ts                # Entry Point (Hono/Express)
│   ├── routes/
│   │   ├── brain-dump.ts       # /api/brain-dump
│   │   ├── adjust-tags.ts      # /api/adjust-tags
│   │   ├── suggest-product.ts  # /api/suggest-product
│   │   ├── reorganize.ts       # /api/reorganize
│   │   ├── library.ts          # /api/library
│   │   └── milestones.ts       # /api/milestones
│   ├── services/
│   │   ├── librarian.service.ts    # AI 整理邏輯
│   │   ├── ai-tracking.service.ts  # AI 使用追蹤
│   │   └── supabase.service.ts     # DB 操作
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT 驗證
│   │   └── logging.middleware.ts   # 請求日誌
│   ├── schemas/                    # Zod Schemas
│   └── types/                      # TypeScript Types
├── Dockerfile
├── cloudbuild.yaml
└── package.json
```

**Hono.js API 範例**:
```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth.middleware';
import { brainDumpRoute } from './routes/brain-dump';

const app = new Hono();

// Middleware
app.use('*', cors({ origin: ['https://zentropy.app'] }));
app.use('*', logger());

// Auth required routes
app.use('/api/*', authMiddleware);

// Routes
app.route('/api/brain-dump', brainDumpRoute);

export default app;
```

---

## 3. Supabase 整合

### 3.1 Schema 設計

直接沿用現有的 Prisma Schema，並新增 AI 追蹤表：

```sql
-- 1. 核心表 (由 Prisma 遷移作為參考，Supabase 可直接用 SQL)
-- areas, products, topics, tasks, milestones, governance_proposals

-- 2. AI 使用追蹤表 (新增)
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- 操作類型
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'brain_dump',       -- 腦內傾倒
    'adjust_tags',      -- 標籤調整
    'suggest_product',  -- 專案推薦
    'reorganize',       -- 結構重組
    'time_inference'    -- 時間推斷
  )),
  
  -- 輸入/輸出
  input_text TEXT,              -- 用戶原始輸入
  input_token_count INTEGER,    -- 輸入 Token 數
  output_json JSONB,            -- AI 輸出結果
  output_token_count INTEGER,   -- 輸出 Token 數
  
  -- 效能指標
  latency_ms INTEGER,           -- 處理時間 (毫秒)
  model_name TEXT,              -- 使用的模型 (gemini-2.5-flash-lite)
  
  -- 品質追蹤
  user_feedback TEXT CHECK (user_feedback IN ('accepted', 'modified', 'rejected')),
  user_modifications JSONB,     -- 用戶修改的內容
  
  -- 上下文
  context_summary JSONB,        -- 傳送給 AI 的上下文摘要
  related_entity_ids UUID[]     -- 相關的 Area/Product/Task IDs
);

-- 索引
CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_operation_type ON ai_usage_logs(operation_type);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);

-- 3. AI 品質評估表 (Daily Health Check)
CREATE TABLE ai_quality_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  usage_log_id UUID REFERENCES ai_usage_logs(id) NOT NULL,
  
  -- Judge Agent 評分
  recall_score DECIMAL(3,2),        -- 關鍵回憶率 (0-1)
  consistency_score DECIMAL(3,2),   -- 邏輯一致性 (0-1)
  compression_ratio DECIMAL(5,2),   -- 壓縮比
  hallucination_detected BOOLEAN,   -- 是否檢測到幻覺
  
  -- 評估詳情
  judge_reasoning TEXT,             -- Judge Agent 的評估理由
  flagged_issues TEXT[],            -- 標記的問題
  
  -- 狀態
  needs_review BOOLEAN DEFAULT FALSE
);
```

### 3.2 Row Level Security (RLS)

```sql
-- 確保用戶只能存取自己的資料
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs"
ON ai_usage_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage logs"
ON ai_usage_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin 可以查看所有 (用於分析)
CREATE POLICY "Admins can view all usage logs"
ON ai_usage_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
```

### 3.3 Realtime 訂閱

```typescript
// Frontend: 監聽任務變更
import { supabase } from '@/lib/supabase';

const channel = supabase
  .channel('tasks-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      console.log('Task changed:', payload);
      // 更新本地狀態
    }
  )
  .subscribe();
```

---

## 4. AI 使用追蹤系統

### 4.1 追蹤服務實作

```typescript
// src/services/ai-tracking.service.ts
import { createClient } from '@supabase/supabase-js';

interface AIUsageLog {
  user_id: string;
  operation_type: 'brain_dump' | 'adjust_tags' | 'suggest_product' | 'reorganize' | 'time_inference';
  input_text?: string;
  input_token_count?: number;
  output_json?: Record<string, unknown>;
  output_token_count?: number;
  latency_ms: number;
  model_name: string;
  context_summary?: Record<string, unknown>;
  related_entity_ids?: string[];
}

export class AITrackingService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async logUsage(log: AIUsageLog): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_usage_logs')
      .insert(log)
      .select('id')
      .single();
    
    if (error) throw error;
    return data.id;
  }

  async updateFeedback(
    logId: string,
    feedback: 'accepted' | 'modified' | 'rejected',
    modifications?: Record<string, unknown>
  ): Promise<void> {
    await this.supabase
      .from('ai_usage_logs')
      .update({
        user_feedback: feedback,
        user_modifications: modifications,
      })
      .eq('id', logId);
  }

  async getUsageStats(userId: string): Promise<{
    total_operations: number;
    by_type: Record<string, number>;
    acceptance_rate: number;
    avg_latency_ms: number;
  }> {
    const { data } = await this.supabase
      .from('ai_usage_logs')
      .select('operation_type, user_feedback, latency_ms')
      .eq('user_id', userId);
    
    if (!data) return { total_operations: 0, by_type: {}, acceptance_rate: 0, avg_latency_ms: 0 };
    
    const byType = data.reduce((acc, log) => {
      acc[log.operation_type] = (acc[log.operation_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const withFeedback = data.filter(d => d.user_feedback);
    const accepted = withFeedback.filter(d => d.user_feedback === 'accepted').length;
    
    return {
      total_operations: data.length,
      by_type: byType,
      acceptance_rate: withFeedback.length ? accepted / withFeedback.length : 0,
      avg_latency_ms: data.reduce((sum, d) => sum + (d.latency_ms || 0), 0) / data.length,
    };
  }
}
```

### 4.2 Brain Dump API 整合追蹤

```typescript
// src/routes/brain-dump.ts
import { Hono } from 'hono';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { AITrackingService } from '../services/ai-tracking.service';

const route = new Hono();

route.post('/', async (c) => {
  const { text, userId } = await c.req.json();
  const tracking = new AITrackingService(c.get('supabase'));
  
  const startTime = Date.now();
  
  try {
    // 構建上下文
    const context = await buildContext(userId);
    const inputTokenCount = estimateTokens(text + JSON.stringify(context));
    
    // 調用 AI
    const { object: result, usage } = await generateObject({
      model: google('gemini-2.5-flash-lite'),
      schema: StructureResultSchema,
      prompt: buildPrompt(text, context),
    });
    
    const latency = Date.now() - startTime;
    
    // 記錄 AI 使用
    const logId = await tracking.logUsage({
      user_id: userId,
      operation_type: 'brain_dump',
      input_text: text,
      input_token_count: inputTokenCount,
      output_json: result,
      output_token_count: usage?.completionTokens,
      latency_ms: latency,
      model_name: 'gemini-2.5-flash-lite',
      context_summary: {
        areas_count: context.areas.length,
        products_count: context.products.length,
        milestones_count: context.milestones.length,
      },
    });
    
    // 返回結果附帶 log ID (供前端回報反饋)
    return c.json({
      success: true,
      items: result.items,
      _tracking_id: logId,  // 前端可用此 ID 回報用戶反饋
    });
    
  } catch (error) {
    // 記錄失敗
    await tracking.logUsage({
      user_id: userId,
      operation_type: 'brain_dump',
      input_text: text,
      latency_ms: Date.now() - startTime,
      model_name: 'gemini-2.5-flash-lite',
      output_json: { error: error.message },
    });
    
    throw error;
  }
});

export { route as brainDumpRoute };
```

### 4.3 前端反饋回報

```typescript
// 前端：用戶確認/修改 AI 結果後回報
async function submitFeedback(
  trackingId: string,
  accepted: boolean,
  modifications?: object
) {
  await apiClient('/api/ai-feedback', {
    method: 'POST',
    body: JSON.stringify({
      tracking_id: trackingId,
      feedback: accepted ? 'accepted' : 'modified',
      modifications,
    }),
  });
}
```

### 4.4 Dashboard 統計視圖

```typescript
// 管理後台：AI 使用統計 Dashboard

// 1. 總體統計
const overallStats = await supabase.rpc('get_ai_usage_stats', {
  start_date: '2026-01-01',
  end_date: '2026-01-31',
});

// 2. 依操作類型分布
// 3. 接受率趨勢
// 4. 平均延遲
// 5. Token 消耗趨勢
```

---

## 5. 部署流程

### 5.1 CI/CD 設置 (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install & Build
        run: |
          cd zentropy-web
          npm ci
          npm run build
          npm run export
      
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: zentropy-app

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: zentropy-api
          source: zentropy-api
          region: asia-east1
```

### 5.2 環境變數

**Frontend (Firebase Hosting)**:
```env
NEXT_PUBLIC_API_URL=https://api.zentropy.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Backend (Cloud Run)**:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service Role for server-side
GOOGLE_AI_API_KEY=xxx
```

---

## 6. 遷移計畫

### Phase 1: 基礎設施建置 (Week 1)

- [ ] 建立 Supabase 專案
- [ ] 遷移 Schema 到 Supabase
- [ ] 設定 RLS Policies
- [ ] 建立 Firebase 專案
- [ ] 設定 GitHub Actions

### Phase 2: 後端 API 遷移 (Week 2)

- [ ] 建立 Cloud Run 專案結構
- [ ] 遷移 brain-dump API
- [ ] 遷移 adjust-tags API
- [ ] 遷移 suggest-product API
- [ ] 遷移 reorganize API
- [ ] 實作 AI 追蹤服務

### Phase 3: 前端分離 (Week 3)

- [ ] 移除 Next.js API Routes
- [ ] 實作 API Client
- [ ] 整合 Supabase Auth
- [ ] 整合 Supabase Realtime
- [ ] 部署到 Firebase Hosting

### Phase 4: 監控與優化 (Week 4)

- [ ] 建立 AI 使用 Dashboard
- [ ] 實作 Daily Health Check
- [ ] 設定 Alert 機制
- [ ] 效能優化

---

## 7. 成本估算 (Monthly)

| 服務 | 免費額度 | 預估用量 | 預估成本 |
|------|---------|---------|---------|
| Firebase Hosting | 10GB/月 | 2GB | $0 |
| Cloud Run | 200萬請求/月 | 10萬請求 | $0 |
| Supabase (Free) | 500MB DB | 100MB | $0 |
| Supabase (Pro) | 8GB DB | - | $25/月 |
| Google AI | 免費額度 | 視用量 | $5-20/月 |

**建議**: 初期使用免費方案，用戶量增長後升級 Supabase Pro。

---

*此規劃遵循 Zentropy 的 Spec-Driven Development 原則，確保架構升級平順過渡。*
