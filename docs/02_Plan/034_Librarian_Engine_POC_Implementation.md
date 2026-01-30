# 實作計畫：Librarian Engine JS POC
> **使用 Node.js (TypeScript) 驗證 Universal Memory Architecture 的輕量級 POC**

**狀態**: 規劃中 (Planning)
**版本**: 2.0 (JS Rewrite)
**日期**: 2026-01-30
**預計時程**: 1 週

---

## 1. 目標 (Objectives)

本 POC 旨在驗證 **Universal Librarian Engine** 在 **Node.js 環境**下的技術可行性，特別是針對「純前端/全端 JS」團隊的適配性。

### 核心驗證點
1.  **System 1 (Recall)**: 在 Node.js 中實作高效的 RAG 檢索。
2.  **System 2 (Reflect)**: 在缺乏 Python 資料科學庫的情況下，如何用 JS 實現「分群 (Clustering)」與「蒸餾 (Distillation)」。
3.  **Adapters 模式**: 驗證透過 Adapter 介面處理不同專案需求的可行性。

---

## 2. 專案結構 (Standalone Node.js)

這是一個獨立的 Repo 或目錄，不依賴 Next.js 或 Flutter 環境。

```text
poc-librarian-js/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                # 程式入口 (CLI)
│   │
│   ├── core/                   # 核心引擎 (與專案無關)
│   │   ├── types.ts            # Memory, Event 介面定義
│   │   ├── librarian.ts        # 主類別 (Observe/Recall/Reflect)
│   │   ├── vector-store.ts     # PostgreSQL + pgvector 封裝
│   │   └── llm-client.ts       # Gemini/OpenAI 統一介面
│   │
│   ├── adapters/               # 領域適配器
│   │   ├── base-adapter.ts     # 抽象類別
│   │   └── naruvia-adapter.ts  # Naruvia 專用邏輯 (Task Rule)
│   │
│   ├── intelligence/           # System 2 邏輯
│   │   ├── clustering.ts       # JS 實作的分群策略 (K-Means/LLM)
│   │   └── distiller.ts        # 規則歸納邏輯
│   │
│   └── simulation/             # 測試數據生成
│       ├── generator.ts        # 生成假修正數據 (Personas)
│       ├── scenarios.ts        # 定義測試場景
│       └── runner.ts           # 執行 POC 流程
│
└── tests/
```

---

## 3. 技術堆疊 (Tech Stack)

*   **Runtime**: Node.js v20+ (TypeScript)
*   **Database**: Supabase (PostgreSQL + pgvector)
*   **Vector Library**: `@supabase/supabase-js` (直接用 SDK 操作向量，或 `pg` driver)
*   **LLM SDK**: `@google/generative-ai` (Gemini) 或 `openai`
*   **Clustering**: `ml-kmeans` (輕量級 K-Means) 或直接使用 **LLM Agentic Clustering** (讓 LLM 自己分群)

### 關鍵挑戰：JS 裡的 Clustering
Python 有 `sklearn`，JS 只有陽春的 `ml-kmeans`。
**解決方案**:
1.  **方案 A (演算法)**: 使用 `ml-kmeans` 對 Embedding 向量做分群。
2.  **方案 B (LLM)**: 如果數據量小 (<100)，直接把所有修正丟給 LLM 問：「請幫我把這些項目依據修改動機分組」。
    *   *POC 決定*: 優先嘗試 **方案 A (ml-kmeans)** 以驗證成本效益，若效果不佳則 fallback 到方案 B。

---

## 4. 實作流程

### Step 1: 專案初始與資料庫
*   `npm init` & TypeScript config。
*   連接 Supabase，建立 `poc_memories` 與 `poc_corrections` 表 (為了 POC 不污染正式庫，加前綴)。

### Step 2: Core Components 實作
*   **VectorStore**: 實作 `addDocument(vector, metadata)` 與 `similaritySearch(vector)`。
*   **Librarian**: 實作 `observe(event)` (寫入 DB) 與 `recall(query)` (RAG)。

### Step 3: Naruvia Adapter
*   定義 Naruvia 的 Event 格式：
    ```typescript
    interface NaruviaCorrection {
      originalTask: string;
      aiCategory: string;
      userCategory: string;
    }
    ```
*   實作 `formatMemory`: 將 User Correction 轉換為標準 Memory 格式。

### Step 4: System 2 Distillation (最難的部分)
*   **Clustering**:
    1.  讀取未處理的 Corrections。
    2.  Call Embedding API 取得向量。
    3.  Call `ml-kmeans` 分成 K 群 (K 可用简单的 `sqrt(N/2)` 估算或預設 5)。
*   **Induction**:
    1.  對每一群，組裝 Prompt: "These items were all changed from X to Y. Why? Create a rule."
    2.  Call LLM 生成規則。
    3.  存回 Memory。

### Step 5: 模擬與評估
*   寫腳本模擬 **Persona A (老闆)** 與 **Persona B (玩家)** 的 50 筆行為。
*   跑 Baseline (無規則) -> 跑 Training -> 跑 Evaluation (有規則)。
*   產出 Markdown 報告。

---

## 5. 預期產出 (Deliverables)

1.  **Source Code**: Github Repo `library-engine-js-poc`。
2.  **Report**: `POC_Result.md`，包含準確度比較與分群效果分析。
3.  **Evaluation**: 對「JS 做 AI 後端」的最終評估——如果 `ml-kmeans` 效果很爛，還是得回歸 Python。

## 6. 下一步行動
1.  確認此計畫書是否符合需求。
2.  開始寫 Code。
