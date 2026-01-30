# 實作計畫：Librarian Insight Engine (圖書管理員洞察引擎)
> **Naruvia 的自我進化核心：基於神經符號 (Neuro-Symbolic) 的記憶與治理系統**

**狀態**: 草案 (Draft)
**版本**: 1.0
**日期**: 2026-01-30

---

## 1. 執行摘要 (Executive Summary)

**Librarian Insight Engine** 是 Naruvia 區別於傳統 To-Do List 的核心護城河。它不只是一個被動記錄任務的數據庫，而是一個**主動學習用戶行為、自動歸納治理規則的智能系統**。

本計畫旨在解決 AI 應用常見的「越用越笨」或「上下文遺忘」問題。透過 **System 1 (直覺反應)** 與 **System 2 (深層思考)** 的混合架構，讓 AI 隨著用戶的使用時間增長，自動適應並模仿用戶的分類邏輯、命名習慣與優先級判斷，最終達成「比你自己更了解你自己」的境界。

---

## 2. 核心架構：神經符號混合模型 (Neuro-Symbolic Hybrid Model)

我們採用 **"Reflexion" (反思)** 架構，將系統分為兩個認知層次：

### 2.1 System 1: The Fast Retrieval (快思考)
*   **角色**: 直覺反應，處理即時請求。
*   **技術**: Vector Search (pgvector) + RAG。
*   **功能**: 當用戶輸入 "Buy RTX 5090" 時，系統**不需思考**，直接根據過往向量，瞬間判斷這屬於 "Entertainment" 或 "Work" (取決於之前的訓練)。
*   **特點**: 低延遲 (<200ms)、低成本。

### 2.2 System 2: The Slow Distillation (慢思考)
*   **角色**: 深度學習，處理規則歸納。
*   **技術**: LLM (Claude/GPT-4) + Chain of Thought。
*   **功能**: 當用戶糾正 AI "NO! RTX 5090 is for Deep Learning!" 時，System 2 會啟動，分析這數百次的糾正，歸納出一條明確規則：`IF item contains "GPU" AND context is "AI Research" THEN tag = "Work"`。
*   **特點**: 高成本、非同步運行 (Background Job)。

---

## 3. 資料架構 (Data Schema)

利用 Supabase 的 PostgreSQL 特性，我們將結構化數據與向量數據混合儲存。

### 3.1 核心資料表

#### `memories` (長期記憶庫)
存放所有經過蒸餾的知識與觀察。
```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    content TEXT NOT NULL,           -- 記憶內容 (例如：規則描述)
    embedding VECTOR(768),           -- 語意向量 (Gemini 004)
    memory_type TEXT NOT NULL,       -- 'observation' (觀察), 'rule' (規則), 'fact' (事實)
    confidence_score FLOAT DEFAULT 0.5, -- 置信度 (經過幾次驗證？)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `correction_logs` (修正日誌 - 負樣本庫)
這是 AI 學習的最重要來源。記錄 AI 犯錯與用戶修正的過程。
```sql
CREATE TABLE correction_logs (
    id UUID PRIMARY KEY,
    user_id UUID,
    original_input TEXT,             -- 用戶原始輸入 ("Buy milk")
    ai_prediction JSONB,             -- AI 猜測 ("Category: Work")
    user_correction JSONB,           -- 用戶修正 ("Category: Personal")
    feedback_text TEXT,              -- 用戶罵 AI 的話 (可選)
    processed BOOLEAN DEFAULT FALSE  -- 是否已被 System 2 蒸餾過？
);
```

---

## 4. 運作流程 (The Workflow)

### 流程一：推論 (Inference) - 用戶輸入時
1.  **Input**: 用戶輸入 "Schedule meeting with John".
2.  **Retrieve**: 系統將 "Schedule meeting with John" 轉為向量，在 `memories` 中搜尋最相關的規則。
    *   *Match*: 找到規則 "John is the CEO"。
3.  **Augment**: 將 "John is the CEO" 注入 Prompt。
4.  **Generate**: LLM 輸出 "Creating generic High Priority task for meeting with CEO."

### 流程二：蒸餾 (Distillation) - 用戶修正後
1.  **Trigger**: 用戶把上述任務的 Priority 從 "High" 改為 "Low"。
2.  **Log**: 寫入 `correction_logs`。
3.  **Reflect (System 2)**:
    *   背景排程 (Cron Job) 每晚啟動。
    *   讀取未處理的 logs。
    *   LLM 分析模式：「為什麼用戶這次改為 Low？喔，因為標題裡有 'Coffee Chat'」。
    *   生成新規則：`IF title contains "Coffee Chat" THEN priority = "Low"`。
4.  **Upsert**: 將新規則寫入 `memories`。

---

## 5. MCP 整合 (Model Context Protocol)

Librarian Engine 將作為一個 **MCP Server** 運作，這意味著它不僅服務 Naruvia App，還能被 Cursor, Claude Desktop 等外部工具調用。

### 工具定義 (MCP Tools)
*   `access_memory(query)`: 讓外部 Agent 查詢該用戶的 Naruvia 記憶。
*   `record_observation(content)`: 讓外部 Agent 貢獻觀察給 Naruvia。

---

## 6. 導入階段 (Implementation Phases)

### Phase 1: 基礎建設 (The Foundation)
*   [ ] 建立 Supabase `memories` 和 `correction_logs` 表格。
*   [ ] 啟用 `pgvector` extension。
*   [ ] 實作基本的 RAG 檢索 API (Next.js Edge Function)。

### Phase 2: 學習迴路 (The Learning Loop)
*   [ ] 在 Flutter App 端實作「修正捕捉」邏輯 (當用戶修改 AI 建議時觸發)。
*   [ ] 實作 "Diff Analysis"：比較 AI 建議與用戶最終結果的差異。
*   [ ] 建立簡單的 Rule Generator (System 2) 腳本。

### Phase 3: 自動化與優化 (Automation)
*   [ ] 部署 Cron Job 自動執行蒸餾。
*   [ ] 實作「規則衝突」的仲裁機制 (當兩條規則打架時怎麼辦)。
*   [ ] 上線 MCP Server。

---

## 7. 風險與緩解

1.  **冷啟動問題**: 一開始沒規則，AI 很笨。
    *   *解法*: 預載入一套「通用模板」 (General Purpose Template)，隨著使用逐漸被個人規則替換。
2.  **規則污染**: AI 學到錯誤規則 (例如把所有紅色東西都當作緊急)。
    *   *解法*: 規則老化機制 (Rule Decay)。太久沒被驗證的規則自動降權。

---

## 8. 結論

Librarian Insight Engine 是 Naruvia 的靈魂。它將單次互動的價值轉化為長期資產，實現了「越用越好用」的承諾。透過上述的神經符號架構，我們能在保持低成本的同時，提供高度個人化的 AI 體驗。
