# Librarian POC - Per-User Learning Validation

> Universal Librarian Engine 的 JavaScript POC，驗證 Per-User Learning 的技術可行性

## 目標

驗證以下核心假設：

1. **修正率下降**: 用戶修正率從 Phase 1 (70%) 下降到 Phase 3 (<20%)
2. **規則有效性**: 蒸餾出的規則準確率 > 80%
3. **用戶差異化**: 同樣輸入「買 RTX 5090」，Alex → 公司資產，Bob → 個人娛樂

## 快速開始

### 1. 安裝依賴

```bash
cd poc-librarian-js
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env，填入：
# - DATABASE_URL: PostgreSQL 連線字串
# - GOOGLE_GENERATIVE_AI_API_KEY: Gemini API Key
```

### 3. 設定資料庫

```bash
# 建立 poc_librarian schema 和表
npm run db:setup
```

### 4. 執行 POC

```bash
# 執行完整 POC（3 階段驗證）
npm run poc
```

## 執行流程

```
Phase 1: 冷啟動 (Zero-Shot)
├─ 輸入 10 個測試任務
├─ AI 分類（無記憶輔助）
├─ 記錄修正
└─ 預期修正率: 60-80%
          ↓
累積 10 筆修正 → 觸發蒸餾
          ↓
Phase 2: 學習中 (Learning)
├─ 輸入 10 個測試任務
├─ AI 分類（使用規則增強）
├─ 記錄修正
└─ 預期修正率: 30-50%
          ↓
Phase 3: 成熟 (Mature)
├─ 輸入 10 個測試任務
├─ AI 分類（使用成熟規則）
└─ 預期修正率: < 20%
          ↓
差異化測試 → 驗證報告
```

## 測試人物誌

### Alex (創業者)
- SaaS 創業者
- 所有科技產品都是公司資產
- GPU/顯卡 → 公司資產
- AWS/SaaS → 營運成本

### Bob (玩家)
- 軟體工程師
- 下班後是重度玩家
- GPU/顯卡 → 個人娛樂
- AWS/SaaS → 工作工具

## 指令說明

```bash
# 資料庫操作
npm run db:setup      # 建立 schema 和表
npm run db:teardown   # 清理測試資料

# POC 執行
npm run poc           # 執行完整 POC
npm run poc:baseline  # 只執行 Phase 1
npm run poc:train     # 只執行 Phase 2
npm run poc:evaluate  # 只執行 Phase 3
npm run poc:report    # 只生成報告
```

## 專案結構

```
poc-librarian-js/
├── src/
│   ├── core/                 # 核心引擎
│   │   ├── types.ts          # 類型定義
│   │   ├── db.ts             # 資料庫連線
│   │   ├── vector-store.ts   # 向量存儲
│   │   └── llm-client.ts     # LLM 客戶端
│   │
│   ├── intelligence/         # System 2 邏輯
│   │   ├── clustering.ts     # 自適應分群
│   │   └── distiller.ts      # 規則蒸餾
│   │
│   ├── adapters/             # 領域適配器
│   │   ├── base-adapter.ts   # 基礎類別
│   │   └── naruvia-adapter.ts
│   │
│   ├── simulation/           # 模擬系統
│   │   ├── personas.ts       # 測試人物誌
│   │   ├── scenarios.ts      # 測試場景
│   │   ├── generator.ts      # 資料生成
│   │   └── runner.ts         # 執行流程
│   │
│   └── metrics/              # 指標追蹤
│       ├── user-metrics.ts   # 用戶指標
│       ├── rule-evaluator.ts # 規則評估
│       └── report-generator.ts
│
├── scripts/
│   ├── setup-db.ts           # 資料庫設置
│   ├── teardown-db.ts        # 資料清理
│   └── run-poc.ts            # POC 執行
│
└── reports/                  # 產出報告
```

## 成功標準

| 指標 | 目標 |
|------|------|
| Phase 1 修正率 | 60-80% |
| Phase 3 修正率 | < 20% |
| 改善幅度 | > 50% |
| 規則準確率 | > 80% |
| 差異化成功率 | 100% |
| 規則數量 | 3-8 條/用戶 |

## 技術棧

- **Runtime**: Node.js v20+
- **Language**: TypeScript
- **Database**: PostgreSQL + pgvector
- **LLM**: Gemini API (@ai-sdk/google)
- **Clustering**: ml-kmeans (fallback: LLM)

## 安全措施

1. **Schema 隔離**: 所有操作僅在 `poc_librarian` schema
2. **禁止操作**: 阻止對主系統表的刪除操作
3. **環境驗證**: 檢查資料庫連線和 API Key

## 報告範例

執行完成後，報告會儲存在 `reports/` 目錄：

```markdown
# Librarian POC 驗證報告

## 1. 修正率下降曲線

### Alex (創業者)
| 階段 | 修正率 | 趨勢 |
|------|--------|------|
| Phase 1 | 70% | - |
| Phase 2 | 40% | ⬇️ |
| Phase 3 | 10% | ⬇️ |

## 2. 蒸餾出的規則

| # | 規則描述 | 信心度 | 準確率 |
|---|---------|--------|--------|
| 1 | GPU/顯卡 → 公司資產 | 92% | 100% |

## 3. 差異化驗證

| 輸入 | Alex | Bob | 成功 |
|------|------|-----|------|
| 買 RTX 5090 | 公司資產 ✅ | 個人娛樂 ✅ | ✅ |
```

## License

Private - Naruvia Internal
