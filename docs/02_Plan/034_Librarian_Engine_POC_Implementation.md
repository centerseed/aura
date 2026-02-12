# 實作計畫：Librarian Engine JS POC
> **使用 Node.js (TypeScript) 驗證 Universal Memory Architecture 的輕量級 POC**

**狀態**: 已完成並持續迭代 (Completed & Iterating)
**版本**: 3.0
**日期**: 2026-02-12 (更新)
**預計時程**: 1 週（實際已完成）

---

## 1. 目標 (Objectives)

本 POC 旨在驗證 **Universal Librarian Engine** 在 **Node.js 環境**下的技術可行性。

### 1.1 技術驗證點

| 驗證點 | 說明 | 成功標準 |
|--------|------|---------|
| **System 1 (Recall)** | Node.js 中實作高效的 RAG 檢索 | 延遲 < 200ms |
| **System 2 (Reflect)** | JS 實現分群與蒸餾 | 產出合理規則 |
| **Adapters 模式** | 透過 Adapter 處理不同專案需求 | 介面可擴展 |

### 1.2 商業驗證點 (Per-User Learning)

**核心假設**：系統能為不同用戶學習不同的分類習慣，讓用戶越來越少做出修改。

```
用戶 A (創業者 Alex):  「買 RTX 5090」→ 公司資產
用戶 B (玩家 Bob):     「買 RTX 5090」→ 個人娛樂

同樣的輸入，系統必須對 A 和 B 給出不同答案
```

| 假設 | 驗證方式 | 成功標準 |
|------|---------|---------|
| **修正率下降** | 追蹤每階段修正率 | Phase 3 < 20% |
| **規則有效** | 統計規則應用正確率 | > 80% |
| **用戶差異化** | 同一輸入不同結果 | 100% 正確區分 |

---

## 2. 專案結構 (Standalone Node.js)

獨立的專案目錄，不依賴 Next.js 或 Flutter 環境。

```text
poc-librarian-js/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
│
├── src/
│   ├── index.ts                  # 程式入口 (CLI)
│   │
│   ├── core/                     # 核心引擎 (與專案無關)
│   │   ├── types.ts              # Memory, Event, Rule 介面定義
│   │   ├── librarian.ts          # 主類別 (Observe/Recall/Reflect)
│   │   ├── vector-store.ts       # PostgreSQL + pgvector 封裝
│   │   └── llm-client.ts         # Gemini/OpenAI 統一介面
│   │
│   ├── adapters/                 # 領域適配器
│   │   ├── base-adapter.ts       # 抽象類別
│   │   └── naruvia-adapter.ts    # Naruvia 專用邏輯 (Task Rule)
│   │
│   ├── intelligence/             # System 2 邏輯
│   │   ├── clustering.ts         # JS 分群策略 (K-Means/LLM)
│   │   └── distiller.ts          # 規則歸納邏輯
│   │
│   ├── simulation/               # 測試數據生成與模擬
│   │   ├── personas.ts           # 定義測試人物誌
│   │   ├── generator.ts          # 生成假修正數據
│   │   ├── scenarios.ts          # 定義測試場景
│   │   └── runner.ts             # 執行 POC 流程
│   │
│   └── metrics/                  # 🆕 指標追蹤
│       ├── user-metrics.ts       # 用戶修正率追蹤
│       ├── rule-evaluator.ts     # 規則有效性評估
│       └── report-generator.ts   # 報告生成
│
├── reports/                      # 產出報告
│   └── .gitkeep
│
└── tests/
    └── ...
```

---

## 3. 技術堆疊 (Tech Stack)

| 類別 | 技術 | 說明 |
|------|------|------|
| **Runtime** | Node.js v20+ | TypeScript |
| **Database** | Supabase | PostgreSQL + pgvector |
| **Vector** | `pg` driver | 直接操作向量欄位 |
| **LLM SDK** | `@google/generative-ai` | Gemini API |
| **Clustering** | `ml-kmeans` / LLM | 見下方策略 |

### 3.1 JS 分群策略

Python 有 `sklearn`，JS 只有陽春的 `ml-kmeans`。

| 方案 | 適用情境 | 優點 | 缺點 |
|------|---------|------|------|
| **A: ml-kmeans** | 數據量 > 20 | 成本低、速度快 | 可能不如 DBSCAN 精準 |
| **B: LLM 分群** | 數據量 < 20 | 更智能、更彈性 | 成本較高 |

**POC 策略**：優先嘗試 **方案 A (ml-kmeans)**，若效果不佳則 fallback 到方案 B。

---

## 4. Per-User Learning 驗證設計

### 4.1 驗證流程

```
┌────────────────────────────────────────────────────────────┐
│                 Per-User Learning 驗證流程                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: 冷啟動 (輸入 1-10)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Alex: 輸入「買 RTX 5090」→ AI 猜「個人」→ ❌ 修正    │   │
│  │ Bob:  輸入「買 RTX 5090」→ AI 猜「公司」→ ❌ 修正    │   │
│  │                                                      │   │
│  │ 預期修正率: 60-80%                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↓                                   │
│  累積 10 筆修正 → 觸發蒸餾                                   │
│                         ↓                                   │
│  Phase 2: 學習中 (輸入 11-20)                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Alex 規則: 「GPU/顯卡 → 公司資產」                    │   │
│  │ Bob 規則:  「GPU/顯卡 → 個人娛樂」                    │   │
│  │                                                      │   │
│  │ 預期修正率: 30-50%                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↓                                   │
│  Phase 3: 成熟 (輸入 21-30)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Alex: 輸入「買 RTX 5090」→ AI 猜「公司」→ ✅ 正確！  │   │
│  │ Bob:  輸入「買 RTX 5090」→ AI 猜「個人」→ ✅ 正確！  │   │
│  │                                                      │   │
│  │ 預期修正率: < 20%                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 4.2 測試人物誌 (Personas)

```typescript
// src/simulation/personas.ts

export const PERSONAS = {
  alex: {
    id: 'alex',
    name: 'Alex (創業者)',
    description: 'SaaS 創業者，所有科技產品都是公司資產',
    rules: {
      'GPU/顯卡/RTX': 'Company Asset',
      'AWS/Vercel/SaaS': 'Operating Cost',
      '課程/學習': 'Investment',
      'Netflix/遊戲': 'Personal'
    }
  },
  bob: {
    id: 'bob',
    name: 'Bob (玩家)',
    description: '軟體工程師，下班後是重度玩家',
    rules: {
      'GPU/顯卡/RTX': 'Personal Entertainment',
      'AWS/Vercel': 'Work Tools',
      'Steam/遊戲/PS5': 'Personal Entertainment',
      '課程/學習': 'Career Development'
    }
  }
};
```

### 4.3 差異化測試案例

```typescript
// src/simulation/scenarios.ts

export const DIFFERENTIATION_TESTS = [
  {
    input: '買 RTX 5090',
    expected: { alex: 'Company Asset', bob: 'Personal Entertainment' }
  },
  {
    input: '續訂 AWS 年費',
    expected: { alex: 'Operating Cost', bob: 'Work Tools' }
  },
  {
    input: '買 Steam 遊戲',
    expected: { alex: 'Personal', bob: 'Personal Entertainment' }
  },
  {
    input: '報名 AI 課程',
    expected: { alex: 'Investment', bob: 'Career Development' }
  }
];
```

---

## 5. 指標追蹤系統

### 5.1 用戶指標

```typescript
// src/metrics/user-metrics.ts

interface UserMetrics {
  userId: string;

  // 累計統計
  totalInputs: number;
  totalCorrections: number;
  correctionRate: number;           // corrections / inputs

  // 階段統計 (每 10 筆為一階段)
  phases: PhaseMetrics[];

  // 學習效果
  learningCurve: number[];          // 每階段的修正率
  improvement: number;              // (phase1 - phase3) / phase1
}

interface PhaseMetrics {
  phaseNumber: number;
  inputs: number;
  corrections: number;
  correctionRate: number;
  rulesApplied: number;
  rulesEffective: number;           // 規則應用且正確的次數
}
```

### 5.2 規則指標

```typescript
// src/metrics/rule-evaluator.ts

interface RuleMetrics {
  ruleId: string;
  userId: string;

  description: string;              // "GPU 相關 → 公司資產"
  confidence: number;               // 蒸餾時的信心度

  // 應用統計
  timesApplied: number;
  timesCorrect: number;
  accuracy: number;                 // timesCorrect / timesApplied

  // 狀態
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}
```

### 5.3 成功標準

| 指標 | 目標 | 計算方式 |
|------|------|---------|
| **Phase 1 修正率** | 60-80% | corrections / inputs |
| **Phase 3 修正率** | < 20% | corrections / inputs |
| **修正率下降幅度** | > 50% | (phase1 - phase3) / phase1 |
| **規則平均準確率** | > 80% | Σ(accuracy) / ruleCount |
| **差異化成功率** | 100% | 同一輸入不同結果 |
| **規則數量合理** | 3-8 條/用戶 | 檢查規則庫大小 |

---

## 6. 實作流程

### Step 1: 專案初始與資料庫

```bash
npm init -y
npm install typescript tsx @types/node -D
npm install @google/generative-ai pg ml-kmeans dotenv
```

**資料庫 Schema**：

```sql
-- POC 專用 Schema (Supabase)
CREATE SCHEMA IF NOT EXISTS poc_librarian;

-- 啟用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 修正紀錄表
CREATE TABLE poc_librarian.corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,

    original_input TEXT NOT NULL,
    ai_prediction JSONB NOT NULL,
    user_correction JSONB NOT NULL,
    corrected_field TEXT NOT NULL,

    embedding VECTOR(768),
    processed BOOLEAN DEFAULT FALSE,
    phase_number INT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 規則表
CREATE TABLE poc_librarian.rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,

    description TEXT NOT NULL,
    trigger_conditions JSONB,
    result_action JSONB,

    confidence FLOAT DEFAULT 0.5,
    times_applied INT DEFAULT 0,
    times_correct INT DEFAULT 0,

    embedding VECTOR(768),
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- 評估記錄表
CREATE TABLE poc_librarian.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    phase_number INT NOT NULL,

    input TEXT NOT NULL,
    expected_output JSONB,
    actual_output JSONB,
    is_correct BOOLEAN,

    rules_applied UUID[],
    latency_ms INT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX ON poc_librarian.corrections (user_id, processed);
CREATE INDEX ON poc_librarian.rules (user_id, is_active);
CREATE INDEX ON poc_librarian.corrections USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON poc_librarian.rules USING hnsw (embedding vector_cosine_ops);
```

### Step 2: Core Components 實作

- **VectorStore**: `addDocument(vector, metadata)` 與 `similaritySearch(vector, topK)`
- **Librarian**: `observe(event)`, `recall(userId, query)`, `reflect(userId)`

### Step 3: Naruvia Adapter

```typescript
interface NaruviaCorrection {
  userId: string;
  originalTask: string;
  aiCategory: string;
  userCategory: string;
}
```

### Step 4: System 2 Distillation

1. 讀取未處理的 Corrections
2. 計算 Embedding
3. ml-kmeans 分群 (K = sqrt(N/2) 或預設 5)
4. 對每群組 LLM 歸納規則
5. 儲存規則到 Memory

### Step 5: 模擬與評估

執行完整的 3 階段驗證流程。

---

## 7. 模擬執行邏輯

```typescript
// src/simulation/runner.ts

interface SimulationConfig {
  personas: Persona[];
  inputsPerPhase: number;           // 每階段輸入數 (預設 10)
  totalPhases: number;              // 總階段數 (預設 3)
  distillThreshold: number;         // 蒸餾觸發閾值 (預設 10)
}

async function runSimulation(config: SimulationConfig) {
  const results: Record<string, UserMetrics> = {};

  for (const persona of config.personas) {
    console.log(`\n🧪 Testing Persona: ${persona.name}`);

    const metrics = initMetrics(persona.id);

    for (let phase = 1; phase <= config.totalPhases; phase++) {
      console.log(`\n  Phase ${phase}:`);

      const phaseMetrics = initPhaseMetrics(phase);
      const inputs = generateInputsForPhase(persona, phase, config.inputsPerPhase);

      for (const input of inputs) {
        // 1. 檢索規則
        const rules = await librarian.recall(persona.id, input);

        // 2. AI 分類 (使用規則增強)
        const prediction = await classify(input, rules);

        // 3. 判斷是否需要修正
        const expected = getExpectedOutput(input, persona);
        const needsCorrection = prediction !== expected;

        // 4. 記錄指標
        updateMetrics(phaseMetrics, needsCorrection, rules);

        if (needsCorrection) {
          // 5. 記錄修正
          await librarian.observe({
            userId: persona.id,
            type: 'correction',
            input,
            aiPrediction: prediction,
            userCorrection: expected,
            phaseNumber: phase
          });
        } else {
          // 6. 更新規則有效性
          await updateRuleEffectiveness(rules, true);
        }

        // 7. 檢查是否觸發蒸餾
        const pendingCount = await getPendingCount(persona.id);
        if (pendingCount >= config.distillThreshold) {
          console.log(`    🔄 Triggering distillation...`);
          await librarian.reflect(persona.id);
        }
      }

      // 記錄階段結果
      metrics.phases.push(phaseMetrics);
      printPhaseResult(phaseMetrics);
    }

    // 計算學習效果
    calculateLearningEffect(metrics);
    results[persona.id] = metrics;
  }

  // 執行差異化測試
  await runDifferentiationTests(config.personas);

  // 生成報告
  await generateReport(results);
}
```

---

## 8. 報告格式

### 8.1 執行摘要

```markdown
# Librarian POC 驗證報告

執行時間: 2026-01-30T15:00:00Z

## 1. 修正率下降曲線

### Alex (創業者)

| 階段 | 輸入數 | 修正數 | 修正率 | 趨勢 |
|------|--------|--------|--------|------|
| Phase 1 | 10 | 7 | 70% | - |
| Phase 2 | 10 | 4 | 40% | ⬇️ -30% |
| Phase 3 | 10 | 1 | 10% | ⬇️ -30% |

**學習效果**: ✅ 修正率從 70% 下降到 10% (改善 85.7%)

### Bob (玩家)

| 階段 | 輸入數 | 修正數 | 修正率 | 趨勢 |
|------|--------|--------|--------|------|
| Phase 1 | 10 | 8 | 80% | - |
| Phase 2 | 10 | 5 | 50% | ⬇️ -30% |
| Phase 3 | 10 | 2 | 20% | ⬇️ -30% |

**學習效果**: ✅ 修正率從 80% 下降到 20% (改善 75.0%)
```

### 8.2 規則庫可視化

```markdown
## 2. 蒸餾出的規則

### Alex 的規則庫 (3 條)

| # | 規則描述 | 信心度 | 應用次數 | 準確率 |
|---|---------|--------|---------|--------|
| 1 | GPU/顯卡/RTX → 公司資產 | 92% | 8 | 100% |
| 2 | AWS/訂閱/年費 → 營運成本 | 85% | 5 | 80% |
| 3 | 課程/學習 → 人才投資 | 78% | 3 | 67% |

### Bob 的規則庫 (3 條)

| # | 規則描述 | 信心度 | 應用次數 | 準確率 |
|---|---------|--------|---------|--------|
| 1 | GPU/顯卡/RTX → 個人娛樂 | 90% | 7 | 100% |
| 2 | Steam/遊戲/PS5 → 個人娛樂 | 95% | 10 | 100% |
| 3 | AWS/Vercel → 工作工具 | 82% | 4 | 75% |
```

### 8.3 差異化驗證

```markdown
## 3. 用戶差異化驗證

| 輸入 | Alex 預測 | Bob 預測 | 差異化成功 |
|------|----------|----------|-----------|
| 買 RTX 5090 | 公司資產 ✅ | 個人娛樂 ✅ | ✅ |
| 續訂 AWS | 營運成本 ✅ | 工作工具 ✅ | ✅ |
| 買 Steam 遊戲 | 個人 ✅ | 個人娛樂 ✅ | ✅ |

**結論**: 系統成功區分不同用戶的個人化偏好 (4/4 = 100%)
```

### 8.4 效能與成本

```markdown
## 4. 效能與成本分析

| 指標 | 數值 |
|------|------|
| 平均蒸餾時間 | 12 秒 |
| 平均檢索延遲 | 85ms |
| Embedding API 呼叫 | 60 次 |
| LLM 蒸餾呼叫 | 6 次 (3 群集 × 2 用戶) |
| 總成本 | $0.05 |

## 5. 結論

✅ **Per-User Learning 驗證成功**
- 修正率顯著下降
- 規則準確率 > 80%
- 用戶差異化 100%

**建議**: 可進入 MVP 整合階段
```

---

## 9. 執行指令

```bash
# 安裝依賴
cd poc-librarian-js
npm install

# 設定環境變數
cp .env.example .env
# 編輯 .env，填入 SUPABASE_URL, SUPABASE_KEY, GOOGLE_API_KEY

# 初始化資料庫
npm run db:setup

# 執行完整 POC
npm run poc

# 或分步執行
npm run poc:baseline     # Phase 1
npm run poc:train        # Phase 2 (蒸餾)
npm run poc:evaluate     # Phase 3
npm run poc:report       # 生成報告
```

---

## 10. 風險與緩解

| 風險 | 可能性 | 緩解措施 |
|------|--------|----------|
| ml-kmeans 效果差 | 中 | Fallback 到 LLM 分群 |
| 規則品質不穩定 | 中 | 調整 prompt、增加 few-shot |
| 差異化失敗 | 低 | 檢查 user_id 隔離邏輯 |
| Supabase 連線問題 | 低 | 加入重試機制 |

---

## 11. 預期產出 (Deliverables)

1. **Source Code**: `poc-librarian-js/` 目錄
2. **Report**: `reports/POC_Result.md`
3. **Evaluation**: 對「JS 做 AI 後端」的最終評估

---

## 12. System 2 改進方案研究

### 12.1 學術研究方向

經過文獻調研，以下是 System 2（LLM 蒸餾）的進階改進方向：

#### A. P-RLHF (Personalized RLHF)
- **核心思想**: 輕量級 User Model + LLM 聯合學習
- **優點**: 用 User Model 編碼用戶偏好，減少 LLM 呼叫
- **適用**: 用戶數量多、偏好差異大的場景
- **參考**: [Personalized Soups: Personalized Large Language Model Alignment via Post-hoc Parameter Merging](https://arxiv.org/abs/2310.11564)

#### B. Coactive Learning (協作學習)
- **核心思想**: 從用戶的隱性反饋（implicit correction）學習
- **優點**: 不需要明確的修正，從行為模式推斷偏好
- **適用**: 用戶懶得修正但有明確行為模式的場景
- **參考**: Coactive Learning for Interactive Decision Making

#### C. Memory Hierarchy (記憶層級)
- **核心思想**: 分層記憶架構，類似人腦
  - **Episodic Memory**: 原始事件（修正紀錄）
  - **Semantic Memory**: 抽象知識（蒸餾規則）
  - **Procedural Memory**: 行為習慣（自動化模式）
- **優點**: 不同層級適用不同檢索策略
- **適用**: 複雜的長期學習場景

#### D. Continual Learning (持續學習)
- **核心思想**: 記憶鞏固 + 遺忘機制（ACT-R 模型）
- **技術**:
  - **Memory Consolidation**: 重要記憶強化
  - **Spaced Repetition**: 間隔重複提升保留
  - **Decay Function**: 使用頻率決定記憶強度
- **優點**: 防止規則庫無限膨脹
- **參考**: ACT-R 認知架構

#### E. Neuro-Symbolic (神經符號結合)
- **核心思想**: LLM 產出 + 符號邏輯驗證
- **技術**:
  - **Differentiable ILP**: 可微分歸納邏輯編程
  - **Logic Verification**: 符號系統驗證規則一致性
- **優點**: 規則可解釋、可驗證
- **適用**: 需要高確定性的場景

### 12.2 POC 已實作的改進

| 改進 | 狀態 | 說明 |
|------|------|------|
| **規則驗證迴圈** | ✅ | 新規則與現有規則衝突檢測（duplicate/similar/conflict） |
| **規則合併** | ✅ | 相似規則自動合併統計 |
| **使用頻率衰減** | ✅ | 30/60 天未使用降權/歸檔，每次 observe 自動觸發 |
| **多階段蒸餾** | ✅ | Stage 0 aging → Stage 1 分群 → Stage 2 蒸餾 → Stage 3 驗證 → Stage 4 標記 → Stage 4.5 清理 |
| **Silhouette Score** | ✅ | 分群品質驗證 |
| **Instant Rule** | ✅ | 單次修正直接建立低信心度規則，下次 recall 即可用（取代 Warm Path） |
| **多欄位修正** | ✅ | 支援 product + topic 同時建立 Instant Rules |
| **Hot Path 通用化** | ✅ | 支援 product/topic/category 等多欄位匹配 |
| **Corrections 標記** | ✅ | Instant Rule 建立成功 → correction 標記 processed，避免 Cold Path 重複蒸餾 |
| **蒸餾後清理** | ✅ | Cold Path 蒸餾時 archive 被取代的 Instant Rules + 清理垃圾規則 |
| **規則上限** | ✅ | 每用戶 20 條 active 規則上限，超過歸檔 confidence 最低的 |
| ~~Warm Path~~ | 🗑️ 已移除 | 被 Instant Rule 取代，死碼已清理 |

### 12.3 未來可選實作

| 改進 | 優先級 | 複雜度 | 說明 |
|------|--------|--------|------|
| **P-RLHF User Model** | 中 | 高 | 需要訓練輕量級模型 |
| **Implicit Feedback** | 高 | 中 | 從用戶行為推斷偏好（不需要明確修正） |
| ~~Memory Decay (ACT-R)~~ | ~~中~~ | ~~低~~ | ✅ 已實作：30/60 天 aging + 垃圾規則清理 |
| **Logic Verification** | 低 | 高 | 需要符號系統整合 |
| **Recall 語意過濾** | 低 | 中 | 目前 20 條上限夠小，暫不需要 |
| **Cloud Scheduler** | 低 | 低 | aging 已在 observe 時順便跑，不需獨立排程 |

---

## 13. 下一步行動

1. ✅ 確認此計畫書符合需求
2. ✅ 建立專案骨架
3. ✅ 實作 Core Components
4. ✅ 實作 Simulation Runner
5. ✅ 執行驗證並產出報告
6. ✅ 加入 System 2 改進（規則驗證、合併、老化）
7. ✅ 部署為 HTTP 微服務（Cloud Run + API Key 認證）
8. ✅ 整合到 Naruvia API（librarian-client: observe + recall）
9. ✅ 完善規則生命週期（Instant Rule、multi-field、aging、cleanup）
10. 🔜 監控與告警（規則品質追蹤、蒸餾成功率）
11. 🔜 用戶端規則庫 UI（查看/編輯/停用規則）

---

## 13. 未來整合 (Post-POC)

POC 成功後，可透過以下方式整合到產品：

### 用戶端可見的規則庫 UI

```
┌─────────────────────────────────────────┐
│  🧠 你的個人化規則                       │
├─────────────────────────────────────────┤
│                                          │
│  1. GPU 相關購買 → 公司資產              │
│     信心度: 92% | 應用 8 次 | ✅ 啟用     │
│     [編輯] [停用]                         │
│                                          │
│  2. SaaS 訂閱 → 營運成本                 │
│     信心度: 85% | 應用 5 次 | ✅ 啟用     │
│     [編輯] [停用]                         │
│                                          │
│  ────────────────────────────────────    │
│  📊 你的學習進度                          │
│  修正率: 70% → 40% → 10% ⬇️              │
│  系統越來越懂你了！                       │
│                                          │
└─────────────────────────────────────────┘
```
