# ADR-001: Memory System 蒸餾策略與業界調研

> **狀態**: 已核准 (Accepted)
> **日期**: 2026-02-06
> **決策者**: @centerseed
> **關聯**: POC Librarian Engine v2

---

## 1. 背景 (Context)

POC v2 實作了「批次蒸餾」模式：累積 N 筆修正後觸發分群 + LLM 歸納。
為評估此方案的中長期可行性，針對 2025-2026 年業界主流 Memory 系統進行調研。

---

## 2. 業界方案調研

### 2.1 Mem0 — Universal Memory Layer (GitHub 40k+ stars)

**架構**: Extract → Compare → ADD/UPDATE/DELETE/NOOP

- **即時處理**: 每次對話後立即萃取候選記憶
- **CRUD 決策**: 每條新記憶與 vector DB 中 top-s 相似項比較，由 LLM 決定操作
- **Graph 擴展**: Mem0g 用有向圖儲存實體關係
- **效能**: 91% 更低 p95 延遲，節省 90%+ token 成本

**參考**: [github.com/mem0ai/mem0](https://github.com/mem0ai/mem0) / [arxiv 2504.19413](https://arxiv.org/abs/2504.19413)

### 2.2 LangMem — LangChain 官方記憶 SDK

**架構**: 雙層設計

- **Memory Managers**: 萃取 / 更新 / 合併 / 刪除記憶（純狀態轉換，無副作用）
- **Prompt Optimizers**: 根據對話 + feedback score 自動修改 system prompt 中的 rules
- **Profile 機制**: Schema-based 的結構化偏好（如 `preferred_name`, `response_style`）

**關鍵洞察**: Prompt Optimizer 的概念最接近我們的「蒸餾規則」——從互動中歸納 rules 並直接影響下次行為。

**參考**: [github.com/langchain-ai/langmem](https://github.com/langchain-ai/langmem) / [Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)

### 2.3 MemoryOS — EMNLP 2025 Oral

**架構**: 模仿 OS 的三層記憶

| 層級 | 說明 | 晉升機制 |
|------|------|---------|
| Short-term | 當前對話上下文 | FIFO 滿溢 → Mid-term |
| Mid-term | 對話摘要段落 (帶 heat 熱度) | Heat 超過閾值 → Long-term |
| Long-term | 用戶個人 Profile | 穩定保留 |

**關鍵洞察**: 基於「熱度」的自動晉升機制，用訪問頻率 + 互動長度決定記憶重要性。F1 改善 48%。

**參考**: [github.com/BAI-LAB/MemoryOS](https://github.com/BAI-LAB/MemoryOS)

### 2.4 Memobase — User Profile Memory

**架構**: Buffer → Batch Flush → Profile Update

- **Buffer Zone**: 對話累積到 ~1024 tokens 或閒置 1 小時後批次處理
- **固定成本**: 優化至每次更新固定 3 次 LLM 呼叫，成本降 40-50%
- **結構化 Profile**: 預定義 schema（興趣/人口統計/心理特徵）

**關鍵洞察**: Buffer + Flush 模式平衡了即時性與成本。

**參考**: [github.com/memodb-io/memobase](https://github.com/memodb-io/memobase)

### 2.5 SimpleMem — Semantic Density Gating (2026)

**架構**: 三階段管線

1. **Semantic Structured Compression**: 對話壓縮成多視角記憶單元
2. **Online Semantic Synthesis**: 即時合併相關上下文消除冗餘
3. **Intent-Aware Retrieval**: 推斷意圖動態決定檢索範圍

**效能**: 比 Mem0 快 14 倍、F1 改善 26.4%、token 消耗降 30 倍

**參考**: [github.com/aiming-lab/SimpleMem](https://github.com/aiming-lab/SimpleMem) / [arxiv 2601.02553](https://arxiv.org/abs/2601.02553)

### 2.6 MemOS — AI Memory OS

**架構**: Neo4j (Graph) + Qdrant (Vector) + Redis Streams

- 支援 text / multi-modal / tool memory / knowledge base
- Memory Feedback & Correction API
- Skill Memory 跨任務重用

**參考**: [github.com/MemTensor/MemOS](https://github.com/MemTensor/MemOS)

---

## 3. 對比分析

### 3.1 我們的 POC vs 業界方案

| 維度 | 我們的 POC v2 | 業界主流 (Mem0/LangMem) |
|------|--------------|------------------------|
| **記憶萃取** | 依賴用戶「主動修正」 | 從對話「自動萃取」 |
| **規則格式** | 結構化 Rule (trigger + action + confidence) | Profile/Facts 或 Prompt Rules |
| **蒸餾策略** | 批次分群 → LLM 歸納 (累積 N 筆觸發) | 逐條 Extract → Compare → CRUD (即時) |
| **衝突處理** | 有 (duplicate/similar/conflict) | 有 (ADD/UPDATE/DELETE/NOOP) |
| **老化機制** | 有 (30/60 天) | 部分有 (recency/frequency 衰減) |
| **可解釋性** | **高** (規則可讀、可編輯) | 中 (記憶可讀但缺乏結構) |
| **冷啟動延遲** | **高** (需累積 10 筆) | 低 (每次互動即學習) |

### 3.2 我們的差異化優勢

1. **結構化規則**: `trigger_conditions` + `result_action` + `confidence` 比純文字記憶更具可操作性
2. **可解釋性**: 規則可直接展示給用戶看、讓用戶手動編輯
3. **衝突處理 + 老化**: 多數開源方案做得粗糙，我們的更完整
4. **Per-User 隔離**: 透過 `userId` 完全隔離，架構清晰

### 3.3 需要改進的地方

1. **冷啟動延遲**: 累積 10 筆才觸發蒸餾，前 10 次互動完全無法學習
2. **輸入源單一**: 只從顯式修正學習，忽略對話中的隱式偏好
3. **缺少記憶層級**: 只有 Rule 一種類型，缺少 Profile 長期層
4. **分群策略偏重**: K-Means + LLM fallback 對小數據量 overkill

---

## 4. 決策 (Decision)

### 4.1 採用「即時更新 + 定期蒸餾」混合模式

**核心變更**: 在 `observe()` 記錄修正時，立即執行輕量級規則匹配與更新，不再等待累積 N 筆。

```
修正進入
  ├─ [Hot Path] 即時比對現有規則 → UPDATE confidence / ADD 候選
  └─ [Cold Path] 定期批次蒸餾 → 深度分群 + 歸納新規則 + 合併 + 老化
```

**觸發策略**:

| 路徑 | 觸發條件 | 動作 | LLM 呼叫 |
|------|---------|------|---------|
| **Hot Path** | 每次修正 | 向量比對 + 信心度更新 | 0 次 (純向量運算) |
| **Warm Path** | 累積 3 筆未匹配修正 | 嘗試歸納 1 條新規則 | 1 次 |
| **Cold Path** | 累積 10 筆 或 每日定時 | 完整蒸餾 + 維護 | N 次 |

### 4.2 演化路徑

```
Phase 1 (已完成): 批次蒸餾 POC ✅
    ↓
Phase 2 (本次): 加入 Hot Path + Warm Path ← 當前
    ↓
Phase 3 (未來): 擴展輸入源 — 對話隱式萃取
    ↓
Phase 4 (未來): 記憶層級化 — 加入 User Profile 長期層
```

---

## 5. 影響 (Consequences)

### 正面

- 冷啟動延遲從 10 筆修正降至 3 筆（Warm Path）或 1 筆（Hot Path 更新已有規則）
- Hot Path 零 LLM 呼叫，成本不增加
- 保留 Cold Path 深度蒸餾的規則品質優勢
- 結構化規則的差異化優勢不受影響

### 負面

- 增加 `observe()` 的複雜度
- Hot Path 的純向量比對可能不如 LLM 精準
- 需要處理 Hot Path 與 Cold Path 的規則一致性

### 風險緩解

- Hot Path 只做 confidence boost，不改變規則內容
- Warm Path 產出的新規則標記為 `provisional`，Cold Path 時驗證
- Cold Path 維護時統一處理衝突和合併

---

## 6. 參考文獻

- [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413)
- [SimpleMem: Efficient Lifelong Memory for LLM Agents](https://arxiv.org/abs/2601.02553)
- [MemoryOS: Memory OS of AI Agent (EMNLP 2025)](https://aclanthology.org/2025.emnlp-main.1318/)
- [LangMem Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)
- [Personalized LLM Survey](https://arxiv.org/html/2502.11528v2)
