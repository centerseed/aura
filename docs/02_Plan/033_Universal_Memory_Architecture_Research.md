# 研究報告：通用記憶架構 (Universal Memory Architecture)
> **基於 MemGPT、Zep AI、Microsoft GraphRAG 與 Stanford Generative Agents 的深度研究**

**狀態**: 參考資料 (Reference)
**日期**: 2026-01-30

## 1. 執行摘要 (Executive Summary)
本研究旨在為 Naruvia 及未來潛在產品定義一套 **"Universal Memory Protocol (UMP)"**。這套架構吸取了目前業界最先進的長期記憶 (Long-term Memory) 設計模式，旨在解決 LLM **Context Window 限制**與**缺乏持續學習能力**的問題。

**核心結論**:
我們不應綁定特定語言或資料庫 (如 `claude-mem` 綁定 SQLite/Chroma)，而應實作一套 **Tri-Layer Memory Engine (三層式記憶引擎)**。這套引擎以 PostgreSQL (Supabase) 為單一物理層，透過邏輯分層來實現：
1.  **Episodic (事件)**: 什麼時候發生了什麼事？ (Raw Logs)
2.  **Semantic (語意)**: 這些事代表什麼意義？ (Distilled Rules)
3.  **Graph (關聯)**: 這些事與誰有關？ (Relationships)

---

## 2. 競品與學術研究分析

| 架構模型 | 核心概念 (Soul) | 資料結構 (Body) | 對我們的啟示 |
| :--- | :--- | :--- | :--- |
| **MemGPT** | **"OS & Paging"**<br>把 LLM 當 CPU，記憶當 RAM/Disk。核心在於 Context Window 的「換頁 (Paging)」管理。 | **Queue (短期)**<br>**Vector Store (長期)** | 必須有一個「記憶體管理者 (Memory Manager)」來決定什麼時候把資料從 DB 載入 Prompt。 |
| **Stanford Agents** | **"Reflection"**<br>記憶不是靜態的，必須透過「反思 (Reflection)」將原始事件轉化為「高階見解」。 | **Memory Stream (流水帳)**<br>**Reflection Tree (見解樹)** | 原始 Log (Episodic) 和 規則 (Semantic) 必須分開存。規則是由 Log 蒸餾出來的。 |
| **Zep AI** | **"Knowledge Graph"**<br>記憶是有時間性和關聯性的，不只是向量。 | **Episode Graph (事件)**<br>**Fact Graph (事實)** | 在商業邏輯中，**關聯 (Relation)** 比 **相似 (Similarity)** 重要。例如「專案 A」屬於「客戶 B」。 |
| **Microsoft GraphRAG** | **"Community Detection"**<br>找出記憶中的「聚落」，針對聚落做摘要。 | **Knowledge Graph**<br>**Community Summaries** | 對於 User 的分類不一致，我們可以用分群演算法找出「習慣聚落」。 |

---

## 3. Naruvia 通用記憶架構 (Universal Memory Architecture)

這是一個通用架構，可以在不同產品間移植。

### 3.1 層級設計

#### 層級一：記憶介面層 (The Interface Layer)
這是 App 與記憶溝通的唯一窗口。不管底層怎麼變，這一層不變。

```typescript
interface MemoryLayer {
  // 1. 觀察 (Ingest): 寫入原始事件 (快，System 1)
  observe(event: MemoryEvent): Promise<void>;
  
  // 2. 回想 (Retrieve): 根據情境撈取記憶 (快，System 1)
  recall(context: QueryContext): Promise<MemoryFragment[]>;
  
  // 3. 反思 (Reflect): 觸發蒸餾與整理 (慢，System 2 - Background Job)
  reflect(): Promise<Insight[]>;
}
```

#### 層級二：認知處理層 (The Cognitive Layer) - *Librarian Agent*
這一層負責「大腦」的工作。

1.  **The Distiller (蒸餾器)**:
    *   *功能*: 把原始 `Observations` (如：用戶把 Task 改名) 壓縮成 `Learnings` (如：用戶喜歡簡短標題)。
    *   *技術*: 這裡可以隨時替換算法。初期使用 `Vector Clustering`，未來可升級為 `GraphRAG`。
2.  **The Pruner (修剪器)**:
    *   *功能*: 遺忘機制。把太舊、太瑣碎的記憶刪除或封存 (Archived)，避免雜訊干擾 RAG。

#### 層級三：混合儲存層 (The Hybrid Storage Layer) - *Supabase*
利用 Supabase (PostgreSQL) 的多模態特性，把三種記憶存成一張大表的不同面向。

### 3.2 通用 Schema 設計

```sql
-- 這是一張通用的記憶表，適用於任何產品
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 1. 內容 (Content)
  content TEXT NOT NULL,           -- "User changed 'Buy GPU' to 'Company Asset'"
  
  -- 2. 類型 (Type) - 決定記憶的層次
  type TEXT NOT NULL, 
  -- 'EPISODIC': 原始單一事件 (Raw Log) - 用於審計與回溯
  -- 'SEMANTIC': 蒸餾後的事實 (Fact/Rule) - 用於 RAG 推論
  -- 'PROCEDURAL': 流程性知識 (How-to) - 用於 Agent 學習操作
  
  -- 3. 向量 (Vector) - 用於語意搜尋 (Fuzzy Search)
  embedding VECTOR(768),
  
  -- 4. 關聯 (Graph) - 用 JSONB 模擬 Graph Edge (適用於 GraphRAG)
  -- e.g., { "related_to": ["product_id_123"], "derived_from": ["memory_id_456"] }
  metadata JSONB, 
  
  -- 5. 時間與權重
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  importance_score FLOAT DEFAULT 0.5 -- 重要性權重 (參照 Stanford Agents)
);

-- 索引：通吃 關鍵字搜尋 + 向量搜尋 + 關聯查詢
CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON memories USING gin (metadata);
```

---

## 4. 實作策略："Steal the Logic, Build the Integration"

我們不直接引用 `claude-mem` 或 `Zep` 的程式碼庫 (因為技術堆疊不合)，而是採取 **「邏輯移植」** 的策略：

1.  **演算法移植**: 將 `claude-mem` 的 *Endless Mode* 邏輯與 GraphRAG 的 *Community Detection* 邏輯，用 TypeScript 在我們自己的後端實現。
2.  **資料整合**: 因為我們自己掌控 DB，我們可以輕鬆將 `memories` 表與 `tasks`、`users` 表進行 JOIN 查詢，這是使用外部服務做不到的優勢。

這份架構將作為 Naruvia 以及未來所有 AI-Native 產品的基礎記憶層。
