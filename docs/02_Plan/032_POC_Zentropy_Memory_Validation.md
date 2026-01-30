# POC 計畫：Naruvia Librarian 驗證 (JavaScript 實作)
> **目標**: 驗證「記憶蒸餾」架構能有效提升個人化分類準確度

**狀態**: 設計中 (Design)
**版本**: 2.0
**日期**: 2026-01-30
**預計時程**: 3-5 天
**技術棧**: TypeScript + PostgreSQL + Gemini API

---

## 1. 驗證目標 (Objectives)

透過實證數據證明：

| 假設 | 驗證方式 | 成功標準 |
|------|---------|---------|
| **記憶蒸餾有效** | 從修正中萃取規則 | 產出合理的 IF-THEN 規則 |
| **準確度提升** | 對比 Zero-Shot vs RAG | 從 60% 提升到 90%+ |
| **延遲可接受** | 測量檢索時間 | RAG 額外開銷 < 500ms |
| **成本可控** | 計算 LLM 呼叫次數 | 單次蒸餾 < $0.01 |

---

## 2. POC 範圍 (Scope)

### 2.1 獨立驗證腳本

**不整合進主系統**，建立獨立的測試環境：

```
web/poc/librarian/          # 🆕 POC 專用目錄
├── README.md               # 執行說明
├── tsconfig.json
├── package.json
│
├── config.ts               # 設定檔
├── personas.ts             # 測試人物誌
├── test-data.ts            # 測試資料集
│
├── lib/
│   ├── embedding.ts        # Gemini Embedding 封裝
│   ├── clustering.ts       # 簡化版分群（餘弦相似度）
│   ├── llm.ts              # Gemini API 封裝
│   └── db.ts               # PostgreSQL 連線
│
├── scripts/
│   ├── 1-setup-db.ts       # 建立 POC 資料表
│   ├── 2-baseline.ts       # Phase 1: 基準測試
│   ├── 3-train.ts          # Phase 2: 生成修正 + 蒸餾
│   ├── 4-evaluate.ts       # Phase 3: 增強評估
│   └── 5-report.ts         # 生成報告
│
└── reports/                # 輸出報告
    └── .gitkeep
```

### 2.2 測試人物誌

驗證系統能區分不同用戶的個人化偏好：

| Persona | 特徵 | GPU 購買分類 | SaaS 訂閱分類 |
|---------|------|-------------|-------------|
| **創業者 Alex** | SaaS 老闆 | 公司資產 | 營運成本 |
| **玩家 Bob** | 軟體工程師 | 個人娛樂 | 工作工具 |

---

## 3. 三階段實驗設計

```
┌──────────────────────────────────────────────────────────┐
│                    POC 驗證流程                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Phase 1: Baseline (Zero-Shot)                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 輸入 20 個測試任務                                 │   │
│  │  ↓                                                │   │
│  │ Gemini Flash 分類（無記憶輔助）                    │   │
│  │  ↓                                                │   │
│  │ 記錄準確度: ~60-70%                                │   │
│  └───────────────────────────────────────────────────┘   │
│                         ↓                                 │
│  Phase 2: Training (修正 + 蒸餾)                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 生成 30 筆模擬修正（每個 Persona）                  │   │
│  │  ↓                                                │   │
│  │ 計算 Embedding (Gemini text-embedding-004)        │   │
│  │  ↓                                                │   │
│  │ 分群（餘弦相似度 > 0.85）                          │   │
│  │  ↓                                                │   │
│  │ Gemini Pro 歸納規則（每個群集）                    │   │
│  │  ↓                                                │   │
│  │ 儲存到 memories 表（帶向量）                        │   │
│  └───────────────────────────────────────────────────┘   │
│                         ↓                                 │
│  Phase 3: Enhanced (RAG 增強)                             │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 輸入 20 個新測試任務                               │   │
│  │  ↓                                                │   │
│  │ 向量檢索相關規則（pgvector）                        │   │
│  │  ↓                                                │   │
│  │ Gemini Flash + 規則上下文                          │   │
│  │  ↓                                                │   │
│  │ 記錄準確度: >90%                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 資料庫設計

### 4.1 POC Schema (PostgreSQL)

```sql
-- POC 專用 Schema，不影響主系統
CREATE SCHEMA IF NOT EXISTS poc_librarian;

-- 啟用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 修正紀錄表
CREATE TABLE poc_librarian.corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id TEXT NOT NULL,         -- 'alex' or 'bob'

    original_input TEXT NOT NULL,     -- '買 RTX 5090'
    ai_prediction JSONB NOT NULL,     -- {"category": "Personal"}
    user_correction JSONB NOT NULL,   -- {"category": "Company Asset"}
    corrected_field TEXT NOT NULL,    -- 'category' or 'priority'

    embedding VECTOR(768),            -- Gemini embedding
    processed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 蒸餾出的規則表
CREATE TABLE poc_librarian.rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id TEXT NOT NULL,

    rule_description TEXT NOT NULL,   -- '當輸入包含 GPU 時，分類為公司資產'
    trigger_conditions JSONB,         -- ["contains:GPU", "contains:顯卡"]
    result_action JSONB,              -- {"field": "category", "value": "公司資產"}

    confidence FLOAT DEFAULT 0.5,
    source_corrections UUID[],        -- 參考的修正 ID

    embedding VECTOR(768),            -- 規則向量（用於檢索）

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 評估結果表
CREATE TABLE poc_librarian.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id TEXT NOT NULL,
    phase TEXT NOT NULL,              -- 'baseline' or 'enhanced'

    test_input TEXT NOT NULL,
    expected_output JSONB,
    actual_output JSONB,
    is_correct BOOLEAN,

    used_rules UUID[],                -- 應用的規則 ID (僅 enhanced)
    latency_ms INT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX ON poc_librarian.corrections USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON poc_librarian.rules USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON poc_librarian.corrections (persona_id, processed);
CREATE INDEX ON poc_librarian.evaluations (persona_id, phase);
```

---

## 5. 核心實作

### 5.1 Embedding 服務

```typescript
// lib/embedding.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

### 5.2 簡化分群（不用 scikit-learn）

```typescript
// lib/clustering.ts

interface Correction {
  id: string;
  embedding: number[];
  data: any;
}

interface Cluster {
  id: number;
  corrections: Correction[];
  centroid: number[];
}

export function clusterCorrections(
  corrections: Correction[],
  threshold: number = 0.85  // 相似度閾值
): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  corrections.forEach((correction, index) => {
    if (assigned.has(correction.id)) return;

    // 建立新群集
    const cluster: Correction[] = [correction];
    assigned.add(correction.id);

    // 找相似的修正
    corrections.slice(index + 1).forEach(other => {
      if (assigned.has(other.id)) return;

      const similarity = cosineSimilarity(
        correction.embedding,
        other.embedding
      );

      if (similarity >= threshold) {
        cluster.push(other);
        assigned.add(other.id);
      }
    });

    // 至少 2 筆才形成群集
    if (cluster.length >= 2) {
      clusters.push({
        id: clusters.length,
        corrections: cluster,
        centroid: calculateCentroid(cluster.map(c => c.embedding))
      });
    }
  });

  return clusters;
}

function calculateCentroid(embeddings: number[][]): number[] {
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  embeddings.forEach(emb => {
    emb.forEach((val, i) => {
      centroid[i] += val;
    });
  });

  return centroid.map(val => val / embeddings.length);
}
```

### 5.3 規則蒸餾

```typescript
// lib/llm.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function distillRule(
  corrections: Correction[]
): Promise<Rule | null> {
  const prompt = buildDistillationPrompt(corrections);

  const model = genai.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent([
    { text: DISTILLATION_SYSTEM_PROMPT },
    { text: prompt }
  ]);

  const rule = JSON.parse(result.response.text());

  // 驗證規則格式
  if (!validateRule(rule)) return null;

  return rule;
}

const DISTILLATION_SYSTEM_PROMPT = `
你是規則歸納專家。分析用戶的修正紀錄，歸納出明確的分類規則。

規則必須：
1. 具體可執行（避免模糊描述）
2. 使用 IF-THEN 格式
3. 包含觸發條件和預期結果

輸出 JSON 格式：
{
  "rule_description": "當任務包含 'GPU' 或 '顯卡' 時，分類為「公司資產」",
  "trigger_conditions": ["contains:GPU", "contains:顯卡"],
  "result_action": {
    "field": "category",
    "value": "公司資產"
  },
  "confidence": 0.85,
  "reasoning": "基於 5 次修正，用戶一致將 GPU 相關支出歸為公司資產"
}
`;

function buildDistillationPrompt(corrections: Correction[]): string {
  return `
分析以下 ${corrections.length} 筆修正紀錄，歸納出共同規則：

${corrections.map((c, i) => `
修正 ${i + 1}:
- 原始輸入: "${c.original_input}"
- AI 預測: ${JSON.stringify(c.ai_prediction)}
- 用戶修正: ${JSON.stringify(c.user_correction)}
- 修正欄位: ${c.corrected_field}
`).join('\n')}

請歸納出一條明確規則。
`;
}
```

---

## 6. 執行腳本

### 6.1 Phase 1: 基準測試

```typescript
// scripts/2-baseline.ts

import { prisma } from '../lib/db';
import { TEST_TASKS, PERSONAS } from '../test-data';
import { classifyTask } from '../lib/classify';

async function runBaseline() {
  console.log('🔍 Phase 1: Baseline Evaluation (Zero-Shot)\n');

  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    console.log(`Testing ${persona.name}...`);

    let correct = 0;
    const results = [];

    for (const task of TEST_TASKS) {
      const startTime = Date.now();

      // Zero-Shot 分類（無記憶輔助）
      const prediction = await classifyTask(task.input, {
        useRag: false
      });

      const latency = Date.now() - startTime;

      // 對照預期答案
      const expected = getExpectedOutput(task, personaId);
      const isCorrect = compareOutputs(prediction, expected);

      if (isCorrect) correct++;

      // 記錄評估結果
      await prisma.evaluations.create({
        data: {
          persona_id: personaId,
          phase: 'baseline',
          test_input: task.input,
          expected_output: expected,
          actual_output: prediction,
          is_correct: isCorrect,
          latency_ms: latency
        }
      });

      results.push({ task: task.input, isCorrect, latency });
    }

    const accuracy = correct / TEST_TASKS.length;
    console.log(`  Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    console.log(`  Average Latency: ${avgLatency(results)}ms\n`);
  }
}
```

### 6.2 Phase 2: 訓練與蒸餾

```typescript
// scripts/3-train.ts

import { generateCorrections } from '../lib/generate-corrections';
import { generateEmbedding } from '../lib/embedding';
import { clusterCorrections } from '../lib/clustering';
import { distillRule } from '../lib/llm';

async function runTraining() {
  console.log('🔄 Phase 2: Training (Corrections + Distillation)\n');

  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    console.log(`Training for ${persona.name}...`);

    // 1. 生成模擬修正（根據 Persona 特徵）
    const corrections = await generateCorrections(personaId, 30);
    console.log(`  Generated ${corrections.length} corrections`);

    // 2. 計算 embeddings
    for (const correction of corrections) {
      const text = formatCorrectionForEmbedding(correction);
      correction.embedding = await generateEmbedding(text);

      // 儲存到資料庫
      await saveCorrection(correction);
    }

    // 3. 分群
    const clusters = clusterCorrections(corrections, 0.85);
    console.log(`  Found ${clusters.length} clusters`);

    // 4. 對每個群集蒸餾規則
    const rules = [];
    for (const cluster of clusters) {
      const rule = await distillRule(cluster.corrections);

      if (rule) {
        // 計算規則的 embedding
        rule.embedding = await generateEmbedding(rule.rule_description);

        // 儲存規則
        await saveRule(personaId, rule, cluster.corrections);
        rules.push(rule);
      }
    }

    console.log(`  Distilled ${rules.length} rules\n`);

    // 印出規則預覽
    rules.forEach((rule, i) => {
      console.log(`    Rule ${i + 1}: ${rule.rule_description}`);
      console.log(`      Confidence: ${(rule.confidence * 100).toFixed(0)}%`);
    });

    console.log('');
  }
}
```

### 6.3 Phase 3: 增強評估

```typescript
// scripts/4-evaluate.ts

import { recallRules } from '../lib/recall';
import { classifyTask } from '../lib/classify';

async function runEnhanced() {
  console.log('🚀 Phase 3: Enhanced Evaluation (with RAG)\n');

  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    console.log(`Testing ${persona.name} (Enhanced)...`);

    let correct = 0;

    for (const task of TEST_TASKS) {
      const startTime = Date.now();

      // 1. 檢索相關規則
      const rules = await recallRules(personaId, task.input, 5);

      // 2. RAG 增強分類
      const prediction = await classifyTask(task.input, {
        useRag: true,
        rules: rules
      });

      const latency = Date.now() - startTime;

      const expected = getExpectedOutput(task, personaId);
      const isCorrect = compareOutputs(prediction, expected);

      if (isCorrect) correct++;

      // 記錄評估
      await prisma.evaluations.create({
        data: {
          persona_id: personaId,
          phase: 'enhanced',
          test_input: task.input,
          expected_output: expected,
          actual_output: prediction,
          is_correct: isCorrect,
          used_rules: rules.map(r => r.id),
          latency_ms: latency
        }
      });
    }

    const accuracy = correct / TEST_TASKS.length;
    console.log(`  Accuracy: ${(accuracy * 100).toFixed(1)}%\n`);
  }
}
```

### 6.4 報告生成

```typescript
// scripts/5-report.ts

async function generateReport() {
  const results = await prisma.evaluations.groupBy({
    by: ['persona_id', 'phase'],
    _avg: { latency_ms: true },
    _count: { is_correct: true },
    where: { is_correct: true }
  });

  // 生成 Markdown 報告
  const report = `
# Librarian POC 驗證報告

執行時間: ${new Date().toISOString()}

## 執行摘要

| Persona | Baseline | Enhanced | Improvement |
|---------|----------|----------|-------------|
${generateSummaryRows(results)}

## 蒸餾規則

${await generateRulesSummary()}

## 效能分析

${await generatePerformanceAnalysis()}
  `;

  // 儲存報告
  await fs.writeFile(
    `reports/poc_report_${Date.now()}.md`,
    report
  );
}
```

---

## 7. 測試資料

```typescript
// test-data.ts

export const PERSONAS = {
  alex: {
    name: 'Alex (創業者)',
    classification_rules: {
      'GPU/顯卡': 'Company Asset',
      'SaaS 訂閱': 'Operating Cost',
      '學習課程': 'Investment',
      '娛樂': 'Personal'
    }
  },
  bob: {
    name: 'Bob (玩家)',
    classification_rules: {
      'GPU/顯卡': 'Personal Entertainment',
      'AWS/Vercel': 'Work Tools',
      '遊戲訂閱': 'Personal Entertainment',
      '學習課程': 'Career Development'
    }
  }
};

export const TEST_TASKS = [
  // 硬體類（模稜兩可）
  { input: '買 RTX 5090 顯卡', ambiguous: true },
  { input: '訂購 32 吋 4K 螢幕', ambiguous: true },
  { input: '升級 MacBook Pro M4', ambiguous: true },

  // SaaS 類（模稜兩可）
  { input: '續訂 AWS 年費', ambiguous: true },
  { input: '購買 Notion Team Plan', ambiguous: true },
  { input: '升級 Vercel Pro', ambiguous: true },

  // 娛樂類
  { input: '續訂 Netflix', ambiguous: false },
  { input: '買 Steam 遊戲', ambiguous: true },
  { input: 'PS5 Pro 預購', ambiguous: true },

  // 學習類
  { input: '報名 AI 課程', ambiguous: true },
  { input: '買 O\'Reilly 訂閱', ambiguous: true },

  // 會議類
  { input: '約 John 喝咖啡', ambiguous: true },
  { input: '客戶 Demo 會議', ambiguous: false },

  // 更多測試案例...
];
```

---

## 8. 執行方式

```bash
# 安裝依賴
cd web/poc/librarian
npm install

# 設定環境變數
cp .env.example .env
# 編輯 .env，填入 DATABASE_URL 和 GOOGLE_API_KEY

# 執行完整 POC
npm run poc:all

# 或分步執行
npm run poc:setup      # 建立資料表
npm run poc:baseline   # Phase 1
npm run poc:train      # Phase 2
npm run poc:evaluate   # Phase 3
npm run poc:report     # 生成報告
```

---

## 9. 成功標準

| 指標 | 目標 | 驗證方式 |
|------|------|---------|
| **Baseline 準確度** | 50-70% | Phase 1 結果 |
| **Enhanced 準確度** | >90% | Phase 3 結果 |
| **規則有效性** | 100% | 人工檢視每條規則 |
| **RAG 延遲** | <500ms | Phase 3 測量 |
| **蒸餾成本** | <$0.01/次 | 計算 LLM tokens |

---

## 10. 預期輸出

### 範例報告

```markdown
# Librarian POC 驗證報告

## 執行摘要

| Persona | Baseline | Enhanced | Improvement |
|---------|----------|----------|-------------|
| Alex    | 62.5%    | 95.0%    | +32.5%      |
| Bob     | 57.5%    | 92.5%    | +35.0%      |

## Alex 的蒸餾規則

1. **GPU 相關購買屬於公司資產**
   - 信心度: 90%
   - 觸發條件: 包含 "GPU"、"顯卡"、"RTX"、"4090"
   - 推理: 基於 8 次修正，用戶一致將硬體歸類為公司資產

2. **SaaS 訂閱屬於營運成本**
   - 信心度: 85%
   - 觸發條件: 包含 "AWS"、"Vercel"、"訂閱"、"年費"
   - 推理: 基於 6 次修正，用戶將雲端服務視為營運支出

## 效能分析

- 平均蒸餾時間: 15 秒
- 平均檢索延遲: 120ms
- 總成本: $0.08 (30 筆修正 × 2 Personas)
```

---

## 11. 風險與緩解

| 風險 | 可能性 | 緩解措施 |
|------|--------|----------|
| 分群結果太碎片 | 中 | 調整相似度閾值 (0.8-0.9) |
| 規則品質不穩定 | 中 | 調整 prompt、增加範例 |
| pgvector 效能 | 低 | 使用 HNSW 索引 |
| 測試資料不夠真實 | 中 | 邀請真實用戶參與 |

---

## 12. 下一步

POC 成功後：

1. ✅ 整合到 Next.js API Routes
2. ✅ 實作動態蒸餾（累積 10 筆觸發）
3. ✅ 前端捕捉修正事件
4. ✅ 監控與日誌
5. 🔮 考慮是否需要 Python 服務（如需更精準分群）

---

## 13. 技術依賴

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@prisma/client": "^6.0.0",
    "pg": "^8.13.0",
    "pgvector": "^0.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

---

透過這個 JavaScript POC，我們將驗證 Librarian 架構的核心假設，為後續整合到生產系統奠定基礎。
