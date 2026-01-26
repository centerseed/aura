
# Zentropy Librarian Engine Specification

**版本**: v1.0
**定位**: 核心治理引擎與數據演進架構 (The Core Governance & Evolution Engine)

本文件定義了 Zentropy 的核心技術壁壘——Librarian Engine 的內部運作機制。不同於單純的 CRUD 或 Prompt Engineering，Librarian Engine 是一套結合 **Event Sourcing**、**Vector Mathematics** 與 **Recursive Summarization** 的演進式系統，旨在建立「抄不走」的個人化治理體驗。

---

## 1. 核心哲學：Data Evolution (數據演進)

Librarian Engine 不僅管理資料的「現狀 (State)」，更核心的是管理資料的「演變 (Mutation)」與「意圖 (Intent)」。

*   **Static vs. Evolving**: 傳統 PM 工具儲存的是靜態的 Task；Zentropy 儲存的是 Task 在時空中的軌跡。
*   **Universal vs. Personalized**: 傳統 AI 提供通用的分類；Zentropy 通過捕捉「用戶修正」來訓練私有的偏好向量。
*   **List vs. Saga**: 傳統工具提供清單；Zentropy 提供基於實體的連續敘事 (Entity-based Saga)。

---

## 2. 三大核心模組 (Core Modules)

### 2.1 M1: Temporal Knowledge Graph (輕量時空圖譜)
負責記錄實體 (Entity) 在時間軸上的狀態變遷，支援「時空回放」與「趨勢分析」。

*   **目標**: 解決 "State-based" 系統無法理解「過程」的問題。
*   **機制**: 
    *   不儲存所有微小 Event，採用 **Snapshot + Significant Delta** 模式。
    *   使用 JSONB 儲存動態關聯邊 (Relations)。

### 2.2 M2: Personal Intent Vector (個人意圖向量)
負責捕捉用戶的隱性偏好，並將其轉化為數學上的「偏差向量 (Bias Vector)」，用於干預 AI 的決策。

*   **目標**: 解決通用 LLM "One-size-fits-all" 的問題，建立數據護城河。
*   **機制**:
    *   **Capture**: 監聽用戶對 AI 建議的拒絕/修正行為 (Implicit Feedback)。
    *   **Compute**: 計算 `Vector(AI_Proposal) - Vector(User_Action)` 的差值。
    *   **Apply**: 在 RAG 檢索時注入 `User_Bias_Vector`。

### 2.3 M3: Recursive Narrative Memory (遞歸敘事記憶)
負責將碎片化的日常操作，壓縮為有意義的長期敘事 (Saga)。

*   **目標**: 解決 Context Window 限制與長期記憶遺忘問題。
*   **機制**:
    *   **L0 (Raw Events)**: 每日操作日誌。
    *   **L1 (Weekly Saga)**: 每週日自動總結本週 Entity 變化。
    *   **L2 (Monthly Chronicle)**: 每月基於 L1 生成長期趨勢報告。

---

## 3. 資料庫 Schema 設計 (PostgreSQL)

> 擴充自 `008_Database_Schema_Spec`

### 3.1 `entity_snapshots` (M1: 時空快照)
```sql
CREATE TABLE entity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL, -- 指向 Product 或 Area
  entity_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'AREA'
  
  -- 時空座標 (Validity Period)
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL, 
  valid_to TIMESTAMP WITH TIME ZONE, -- NULL 代表目前有效 (Current Head)
  
  -- 狀態快照 (The Node State)
  state_vector VECTOR(768), -- 用戶當時對此 Entity 的語義向量
  status VARCHAR(20),       -- 當時的 Status (ACTIVE, MAINTAIN...)
  
  -- 拓撲關係 (The Edges)
  -- 存儲當時它跟哪些 Topic 有強關聯，及其權重
  -- e.g., { "topics": { "uuid-1": 0.9, "uuid-2": 0.3 }, "linked_tasks_count": 5 }
  relations JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引：支援時空查詢
CREATE INDEX idx_snapshots_temporal ON entity_snapshots (entity_id, valid_from, valid_to);
```

### 3.2 `user_corrections` (M2: 意圖校正)
```sql
CREATE TABLE user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  operation_type VARCHAR(50), -- 'CLASSIFY', 'REORGANIZE'
  target_id UUID,             -- 被操作的 Task/Product ID
  
  -- 向量差值計算
  ai_proposal_vector VECTOR(768), -- AI 原本建議的向量位置
  final_action_vector VECTOR(768), -- 用戶最終決策的向量位置
  correction_delta VECTOR(768),    -- Delta = Final - Proposal
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引：支援快速拉取最近 N 筆校正
CREATE INDEX idx_corrections_user_recent ON user_corrections (user_id, created_at DESC);
```

### 3.3 `narrative_nodes` (M3: 敘事節點)
```sql
CREATE TABLE narrative_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL, -- 屬於哪個 Product/Area
  
  level INT NOT NULL, -- 0=Raw, 1=Weekly Saga, 2=Monthly Chronicle
  
  content TEXT NOT NULL,         -- 摘要文本 (Markdown)
  summary_vector VECTOR(768),    -- 摘要的語義向量 (用於 Search)
  
  -- 時間覆蓋範圍
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- 來源指針 (Merkle-like)
  source_node_ids UUID[], -- 該摘要是由哪些下層節點生成的
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. 演算法邏輯 (Algorithm Logic)

### 4.1 個人化分類演算法 (Personalized Classification)

當 Librarian 需要分類一個新 Task 時：

1.  **Extract**: 提取 Task 內容的 Embedding $E_{task}$。
2.  **Retrieve Bias**: 從 `user_corrections` 拉取該用戶最近 50 筆相關操作的 `correction_delta`，計算平均偏差向量 $\Delta_{bias}$。
3.  **Adjust**: 計算修正後的查詢向量 $E'_{task} = E_{task} + (\alpha \cdot \Delta_{bias})$。
    *   $\alpha$ 為學習率 (Learning Rate)，通常設為 0.3 ~ 0.5。
4.  **Search**: 使用 $E'_{task}$ 在 `entity_snapshots` (Current Head) 中進行 ANN 搜尋，尋找最匹配的 Product/Topic。
5.  **Reasoning**: 將搜尋結果與相似度分數餵給 LLM 進行最終判斷。

### 4.2 滾動敘事生成 (Rolling Saga Generation)

排程任務 (Cron Job) 每週執行一次：

1.  **Collect**: 針對每個 Active Product，撈取本週的 `narrative_nodes (Level 0)` 以及 `entity_snapshots` 的變化。
2.  **Synthesize**: 呼叫 LLM (Gemini 2.0 Flash) 生成週報 (Level 1)。
    *   *Prompt*: "這是 Product X 本週的活動紀錄與狀態變更。請生成一段約 100 字的『演進摘要』，重點在於決策變化與進度推進，而非流水帳。"
3.  **Store**: 存入 `narrative_nodes` (Level 1)，並更新 Product 的 `rolling_summary` 欄位（作為 Cache）。
4.  **Prune**: (可選) 歸檔或軟刪除過舊的 L0 節點以節省空間。

---

## 5. API 介面規劃

### 5.1 Feedback Loop API
*   `POST /api/librarian/feedback`
    *   Payload: `{ taskId, originalProposal, finalAction, actionType }`
    *   功能: 觸發 M2 模組，計算並儲存 `correction_delta`。

### 5.2 Narrative Retrieval API
*   `GET /api/librarian/saga/{productId}`
    *   Params: `level` (default 1), `limit`
    *   功能: 獲取該 Product 的演進故事鏈。

---

## 6. 競爭優勢總結 (The Moat)

這套系統建立的壁壘在於：

1.  **Time**: 對手無法在一夜之間生成用戶過去一年的「敘事鏈」。
2.  **Nuance**: 對手無法模仿用戶透過成千上萬次微小修正所訓練出來的「偏好向量」。
3.  **Architecture**: 對手若無 L1-L2-L3 的本體論支撐，這套演算法將無處掛載 (No Place to Attach)。
