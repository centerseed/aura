# 架構設計：Universal Librarian Engine (通用記憶引擎)
> **一個可跨專案復用的 AI 記憶與學習微服務**

**狀態**: 設計中 (Design)
**版本**: 2.0
**日期**: 2026-01-30

---

## 1. 願景 (Vision)

**Universal Librarian Engine** 不是為單一專案設計的記憶系統，而是一個**通用的 AI 學習基礎設施**，可以透過 Adapter 層服務於不同的應用場景：

- **Naruvia**: 任務分類規則蒸餾 (Task → Category/Priority)
- **Havital**: 訓練對話壓縮與用戶檔案生成 (Conversation → User Profile)
- **未來專案**: 任何需要「越用越聰明」的 AI 應用

---

## 2. 核心理念：System 1 + System 2

基於認知心理學的雙系統理論：

### 2.1 System 1: The Fast Path (快思考)
- **角色**: 即時反應，處理用戶請求
- **技術**: 向量檢索 / 檔案載入
- **延遲**: < 200ms
- **成本**: 極低（本地計算或簡單查詢）

### 2.2 System 2: The Slow Path (慢思考)
- **角色**: 深度學習，歸納新知識
- **技術**: LLM 蒸餾 + 模式分析
- **執行**: 非同步 / 背景任務
- **成本**: 低（按需觸發，非每次請求）

---

## 3. 通用架構設計

### 3.1 三層架構

```
┌────────────────────────────────────────────────────────────┐
│                Layer 1: Core Engine (核心引擎)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Interface (抽象介面)                                 │  │
│  │  - observe(event)      // 記錄事件                   │  │
│  │  - recall(context)     // 檢索記憶                   │  │
│  │  - reflect()           // 蒸餾新知識                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  實作核心邏輯（與專案無關）：                                │
│  - 向量相似度計算                                           │
│  - LLM 呼叫封裝                                             │
│  - 蒸餾工作流                                               │
└────────────────────────────────────────────────────────────┘
                            ↕ (Adapter 層)
┌────────────────────────────────────────────────────────────┐
│           Layer 2: Domain Adapters (領域適配器)             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Naruvia        │  │  Havital        │  ...             │
│  │  Adapter        │  │  Adapter        │                  │
│  ├─────────────────┤  ├─────────────────┤                  │
│  │ 資料格式轉換     │  │ 資料格式轉換     │                  │
│  │ PostgreSQL      │  │ Firestore       │                  │
│  │ 規則型記憶       │  │ 對話型記憶       │                  │
│  └─────────────────┘  └─────────────────┘                  │
└────────────────────────────────────────────────────────────┘
                            ↕
┌────────────────────────────────────────────────────────────┐
│          Layer 3: Storage Backends (儲存後端)               │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  PostgreSQL     │  │  Firestore      │  ...             │
│  │  + pgvector     │  │  NoSQL          │                  │
│  └─────────────────┘  └─────────────────┘                  │
└────────────────────────────────────────────────────────────┘
```

### 3.2 核心抽象介面

所有 Adapter 必須實作以下介面：

```
LibrarianAdapter {
  // 記錄事件（用戶修正、對話輸入等）
  observe(event: Event): Promise<void>

  // 檢索相關記憶（給 LLM 提供上下文）
  recall(query: Query): Promise<Memory[]>

  // 觸發蒸餾（背景任務）
  reflect(): Promise<Insight[]>

  // 格式化輸出（給特定專案使用）
  format(memory: Memory): ProjectSpecificFormat
}
```

---

## 4. 不同專案的 Adapter 設計

### 4.1 Naruvia Adapter (規則型記憶)

**場景**: 任務分類學習

**資料流**:
```
用戶修正任務分類
    ↓
observe({
  type: 'correction',
  input: '買 RTX 5090',
  aiPrediction: { category: 'Personal' },
  userCorrection: { category: 'Company Asset' }
})
    ↓
寫入 correction_logs (PostgreSQL)
    ↓
累積 10-15 筆 → 觸發 reflect()
    ↓
向量分群 + LLM 歸納規則
    ↓
儲存到 memories 表 (帶向量)
    ↓
下次 recall('買顯卡') → 返回規則
```

**記憶類型**:
- **Episodic**: 原始修正紀錄
- **Semantic**: 蒸餾的分類規則（IF-THEN 格式）

**儲存**: PostgreSQL + pgvector

---

### 4.2 Havital Adapter (對話型記憶)

**場景**: 訓練教練對話壓縮

**資料流**:
```
用戶與 Rizo 對話
    ↓
observe({
  type: 'conversation',
  messages: [...最近 10 輪對話]
})
    ↓
寫入 conversation_history (Firestore)
    ↓
每 20 輪對話 → 觸發 reflect()
    ↓
LLM 壓縮為用戶檔案
    ↓
儲存到 user_profiles (Firestore)
    ↓
下次 recall() → 返回壓縮檔案 + 最近 5 輪
```

**記憶類型**:
- **Episodic**: 完整對話歷史
- **Semantic**: 用戶訓練偏好檔案（結構化 JSON）

**儲存**: Firestore (NoSQL)

---

### 4.3 通用 Adapter (未來擴展)

可支援：
- 客服機器人：FAQ 蒸餾
- 程式碼助手：常見 bug pattern 學習
- 寫作助手：用戶風格檔案

---

## 5. API 設計

### 5.1 RESTful API (跨專案統一介面)

#### 記錄事件
```http
POST /api/v1/librarian/observe
Content-Type: application/json
Authorization: Bearer <token>

{
  "project_id": "naruvia",  // 或 "havital"
  "user_id": "xxx",
  "event": {
    "type": "correction" | "conversation" | "feedback",
    "data": { ... }  // 專案特定格式
  }
}
```

#### 檢索記憶
```http
POST /api/v1/librarian/recall
Content-Type: application/json

{
  "project_id": "naruvia",
  "user_id": "xxx",
  "query": "買 GPU",
  "top_k": 5
}

Response:
{
  "memories": [
    {
      "content": "IF input contains 'GPU' THEN category = 'Company Asset'",
      "confidence": 0.85,
      "type": "semantic"
    }
  ]
}
```

#### 觸發蒸餾
```http
POST /api/v1/librarian/reflect
{
  "project_id": "naruvia",
  "user_id": "xxx"
}

Response 202:
{
  "job_id": "xxx",
  "status": "queued"
}
```

### 5.2 內部 Adapter 介面

每個專案提供自己的 Adapter 實作：

```
LibrarianAdapter {
  // 專案特定的資料驗證
  validateEvent(event): boolean

  // 轉換為通用格式
  transformToMemory(event): Memory

  // 執行專案特定的蒸餾邏輯
  distill(events): Insight[]

  // 儲存到專案資料庫
  save(memory): void
}
```

---

## 6. 部署架構

### 6.1 微服務模式 (生產環境)

```
┌─────────────────────────────────────────────┐
│  Naruvia Web (Next.js)                      │
│  - 處理 UI + 簡單 CRUD                       │
└───────────────┬─────────────────────────────┘
                │ HTTP
                ↓
┌─────────────────────────────────────────────┐
│  Librarian Service (Node.js / Python)       │
│  - 獨立 Cloud Run                            │
│  - 處理 observe / recall / reflect           │
│  - 載入不同 Adapter                          │
└───────────────┬─────────────────────────────┘
                │
      ┌─────────┴──────────┐
      ↓                    ↓
┌──────────────┐    ┌──────────────┐
│ PostgreSQL   │    │ Firestore    │
│ (Naruvia)    │    │ (Havital)    │
└──────────────┘    └──────────────┘
```

### 6.2 嵌入式模式 (開發/小型專案)

```
┌─────────────────────────────────────────────┐
│  Next.js App                                 │
│  ├── API Routes (業務邏輯)                   │
│  ├── Librarian Core (npm package)           │
│  │   └── Adapter 實作                        │
│  └── 直接連接資料庫                           │
└─────────────────────────────────────────────┘
```

---

## 7. 關鍵設計決策

### 7.1 為什麼不用向量資料庫（對所有專案）？

| 專案 | 記憶類型 | 是否需要向量 | 原因 |
|------|---------|-------------|------|
| Naruvia | 規則蒸餾 | ✅ 需要 | 相似修正分群需要向量相似度 |
| Havital | 對話壓縮 | ❌ 不需要 | 時間序列壓縮，直接用 LLM 摘要 |

**結論**: Adapter 層決定是否使用向量檢索

### 7.2 為什麼用 Adapter 而非硬編碼？

| 方案 | 彈性 | 維護成本 | 跨專案復用 |
|------|------|---------|-----------|
| 硬編碼 | 低 | 高 | 難 |
| Adapter | 高 | 低 | 易 |

### 7.3 同步 vs 非同步蒸餾

| 觸發方式 | 延遲 | 成本 | 適用場景 |
|---------|------|------|---------|
| 同步（每次請求） | 高 | 高 | 不適用 |
| 非同步（閾值觸發） | 低 | 低 | ✅ Naruvia（10 筆修正） |
| 定時（Cron） | 最低 | 最低 | ✅ Havital（每日壓縮） |

---

## 8. 實作階段

### Phase 1: 核心引擎 (2 週)
- [ ] 定義核心介面 (observe/recall/reflect)
- [ ] 實作 LLM 蒸餾工作流
- [ ] 建立 API 框架

### Phase 2: Naruvia Adapter (1 週)
- [ ] 實作 PostgreSQL + pgvector Adapter
- [ ] 規則蒸餾邏輯
- [ ] POC 驗證（見 032 文件）

### Phase 3: Havital Adapter (1 週)
- [ ] 實作 Firestore Adapter
- [ ] 對話壓縮邏輯
- [ ] 整合到 Rizo Agent

### Phase 4: 生產部署 (1 週)
- [ ] Docker 容器化
- [ ] Cloud Run 部署
- [ ] 監控與日誌

---

## 9. 成本估算

### 單用戶月成本（Naruvia）

| 項目 | 數量 | 單價 | 成本 |
|------|------|------|------|
| Embedding | 100 次修正 | 免費 | $0 |
| 蒸餾（Gemini Flash） | 10 次 | $0.0001/次 | $0.001 |
| 向量檢索 | 1000 次 | 本地計算 | $0 |
| **總計** | - | - | **< $0.01/月** |

### 單用戶月成本（Havital）

| 項目 | 數量 | 單價 | 成本 |
|------|------|------|------|
| 對話壓縮 | 3 次（每 10 輪） | $0.02/次 | $0.06 |
| 節省的 Token | - | - | -$2.5 |
| **淨節省** | - | - | **-$2.44/月** |

---

## 10. 技術選型

### 10.1 核心服務語言

| 語言 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| TypeScript | 與 Next.js 無縫整合 | 缺少 ML 工具 | ✅ 優先 |
| Python | AI 生態豐富 | 需要獨立服務 | 特定 Adapter 使用 |

**結論**: 核心用 TypeScript，Naruvia Adapter 可選用 Python（如需 DBSCAN）

### 10.2 儲存選型

由各 Adapter 決定：
- Naruvia: PostgreSQL + pgvector
- Havital: Firestore
- 其他: Redis / MongoDB / ...

---

## 11. 監控與治理

### 11.1 關鍵指標

| 指標 | 目標 | 說明 |
|------|------|------|
| 蒸餾成功率 | > 95% | 無錯誤完成 |
| 記憶檢索延遲 | < 200ms | System 1 性能 |
| 規則有效性 | > 90% | 人工抽檢 |
| 成本控制 | < $1/用戶/月 | LLM 成本 |

### 11.2 規則老化機制

防止過時規則污染：
- 30 天未使用 → 降權 50%
- 60 天未使用 → 歸檔
- 用戶明確否定 → 立即刪除

---

## 12. 未來展望

### MCP Server 支援
讓 Librarian 可被外部工具（Cursor, Claude Desktop）呼叫：

```
MCP Tools:
- access_memory(user_id, query)
- record_observation(user_id, content)
```

### 跨專案記憶共享
（需隱私審慎設計）
- 匿名化的「通用模板」
- 新用戶冷啟動加速

---

## 13. 結論

Universal Librarian Engine 的核心價值：

1. **可復用**: 一次開發，多專案受益
2. **低成本**: 按需蒸餾，非每次請求
3. **可擴展**: Adapter 模式支援任意資料庫
4. **高效能**: System 1 快速檢索 + System 2 背景學習

透過這個架構，我們將「AI 記憶」從單一專案的功能提升為可復用的基礎設施。
