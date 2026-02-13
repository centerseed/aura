# MCP Functions Design — The Intention-Execution Bridge

**版本**: v2.2
**日期**: 2026-02-13
**變更紀錄**:
- v2.2 (2026-02-13): 合併 Phase 1A/1B 為單一 Phase 1（場景驗證顯示舊分期無法覆蓋核心體驗，Phase 1A 僅實現 1/8 場景）
- v2.1 (2026-02-13): 新增 §12 差距分析、§13 具體實作計畫（基於 Coach 代碼審查）
- v2.0 (2026-02-13): 從 15 tools CRUD 架構重寫為 5 tools Bridge 架構
- v1.0 (已棄用): 15 個 CRUD-style Tools

**前置文件**:
- `docs/01_Specification/001_Product_Definition.md` — 產品定義 (L1-L5 + Execute)
- `docs/01_Specification/010_MCP_Server_Spec.md` — MCP 安全架構 (v2.0)
- `docs/research/Zentropy_vs_OpenClaw_Strategy_Report.md` — 競爭策略

---

## 1. 第一性原理：MCP Server 為什麼要存在？

### 1.1 本質問題

```
Zentropy 知道你「要做什麼」，但不知道「怎麼做」
執行工具知道「怎麼做」，但不知道你「要做什麼」
```

這個斷裂存在於所有領域：

| 領域 | Zentropy 知道的 | 工具知道的 | 斷點（用戶自己在翻譯） |
|:-----|:-------------|:---------|:---------------------|
| 開發 | 「重構 auth 模組，P1，估 4h」 | codebase 結構、依賴、測試覆蓋 | 把意圖翻譯成程式碼動作 |
| 法律 | 「審閱合約，週五前」 | 合約 PDF 全文、法規資料庫 | 把意圖翻譯成審閱要點 |
| 財務 | 「完成 Q1 報稅」 | 帳本數據、稅務表單 | 把意圖翻譯成具體操作 |
| 內容 | 「寫產品更新文」 | 草稿編輯器、過去的文章風格 | 把意圖翻譯成寫作大綱 |

**這個「翻譯」就是摩擦。這個摩擦是很多事情「規劃了但沒執行」的真正原因。**

不是偷懶，是從「我知道要做什麼」到「打開工具開始做」之間有一道認知落差。而 Zentropy 不可能填補工具端的 context（看不到 codebase、合約、帳本），工具也不可能填補 Zentropy 的全局視角（不知道 3 個專案在跑、deadline 衝突、歷史偏差）。

### 1.2 核心結論

> **MCP Server 的核心價值不是「讓 AI 能 CRUD Zentropy 的資料」，而是：成為「腦中的意圖」和「現實的工具」之間的橋樑，降低兩者之間的摩擦。**

具體來說：

```
           Zentropy（意圖層）
           ┌──────────────┐
           │ 整理好的意圖   │  ← L1-L5 的產出：分類好的任務、
           │ + 全局 context │    Coach 的偏差校正、相關知識
           └──────┬───────┘
                  │
         ┌────────┴────────┐
         │   MCP Server    │  ← 橋：把意圖打包成工具能消化的格式
         │  (The Bridge)   │     把工具的產出回流到意圖層
         └────────┬────────┘
                  │
           ┌──────┴───────┐
           │ 執行工具       │  ← Claude Code / Cursor / Calendar /
           │ + domain ctx  │    各種 domain-specific 的工具
           └──────────────┘
```

這意味著：

1. **出站（Zentropy → 工具）**：不只給任務標題，要給**完整的意圖包**——why、相關決策、歷史偏差、驗收標準。讓執行工具拿到就能立刻開工。
2. **入站（工具 → Zentropy）**：執行工具基於 domain context 產生的細節（子任務拆解、執行結果）要能回流。Gatekeeper 接收、Librarian 歸檔、Coach 追蹤。
3. **Zentropy 不試圖取代工具**：不做日曆 CRUD、不做 Git 操作、不做 code generation。Zentropy 做的是讓這些工具**更知道該做什麼**。

### 1.3 這個定位意味著什麼不做

| 不做 | 為什麼 |
|:-----|:------|
| 15 個 CRUD Tools | 那是在做「Todoist API + AI 外掛」，不是橋 |
| 代理執行所有外部動作 | 不可能跟大廠和 OpenClaw 拼整合數量 |
| 在 Zentropy 端做 execution-level planning | Zentropy 看不到 codebase/合約/帳本，硬做就是幻覺 |
| 把 briefing/review 做成 Tool | 環境智慧應該是 Resource（被動注入），不是 Tool（主動觸發） |

---

## 2. 競品研究：為什麼「橋」是差異化

### 2.1 研究範圍

研究了 Heptabase（9 tools）、Todoist（19 tools）、Linear（40+ tools）、Notion（19 tools）、Obsidian、Things 3、Roam Research 的 MCP 實作。

### 2.2 關鍵發現

| 產品 MCP | 本質 | 缺什麼 |
|:---------|:-----|:------|
| Heptabase | 知識庫的讀寫介面 | 沒有行動管理，沒有意圖交接 |
| Todoist | 任務資料庫的 CRUD | 沒有智慧——建立任務後用戶仍需自己翻譯成行動 |
| Linear | 工作流資料庫的 CRUD | 同上，且偏團隊不偏個人 |
| Notion | 通用資料結構的 CRUD | 太泛化，沒有 domain 邏輯 |
| Obsidian | 筆記檔案的讀寫 | 沒有 Agent 智慧 |
| Roam | 知識圖譜 + 記憶原語 | `remember`/`recall` 有啟發，但沒有規劃智慧 |

**所有競品的 MCP 都是「資料端點」——它們暴露的是 database，不是 intelligence。**

沒有任何一個做：
- 結構化的意圖交接（handoff）
- 估時偏差校正
- 想法深化
- 執行結果回流 + 偏差學習

### 2.3 對設計的啟發

| 從競品學到的 | 應用到 Zentropy |
|:-----------|:-------------|
| Heptabase 寫入限制在 inbox + journal append | 入站保守是對的——統一入口，Gatekeeper 判斷 |
| Roam 的 `remember`/`recall` 記憶原語 | Episodic Memory 應是 Resource，被動可讀 |
| Obsidian semantic MCP 把 20+ tools 整合成 5 個 | 語意操作 > 原子操作；少即是多 |
| Todoist 做完整 lifecycle（create→complete→archive） | 閉環是必要的，但由 Agent 驅動而非暴露 CRUD |

---

## 3. 設計原則

1. **Bridge, Not Endpoint**
   - MCP 是橋，不是 Zentropy 的 API
   - 核心問題不是「外部能對 Zentropy 做什麼操作」，而是「意圖和執行之間的摩擦如何降到最低」

2. **Resource-First**
   - 環境智慧透過 Resource 被動注入（AI 開啟 session 就自動有 context）
   - Tool 只用於「必須往回寫」的場景
   - 類比：Resource = Zentropy 的感知能力，Tool = Zentropy 的接收能力

3. **Agent-Mediated, Not CRUD**
   - 不暴露 `createTask` / `updateStatus` / `deleteItem`
   - 暴露的是 Agent 的能力：Gatekeeper 接收、Coach 諮詢、Librarian 檢索
   - 用戶「丟進來」，Agent「處理好」

4. **Structured Handoff**
   - 出站不是「任務標題 + 到期日」，而是**完整意圖包**（why + 相關知識 + 偏差校正 + 驗收標準）
   - 入站不只是自由文字，支援結構化回流（子任務拆解、執行結果 + 時間）

5. **Thin Interface, Thick Backend**
   - MCP Server 只做：認證、驗證、路由、淨化
   - 所有 Agent 邏輯在 Backend API 的 Use Case 層

---

## 4. 架構總覽

```
           ┌─────────────────────────────────┐
           │         Zentropy Agents          │
           │  Gatekeeper · Librarian · Coach  │
           └──────────┬──────────────┬────────┘
                      │              │
              ┌───────┴───┐    ┌────┴──────┐
              │ Resources │    │   Tools   │
              │  (出站)   │    │  (入站)   │
              └───────┬───┘    └────┬──────┘
                      │              │
    ┌─────────────────┼──────────────┼──────────────────┐
    │             MCP Server (The Bridge)                │
    │                                                    │
    │   出站 (Zentropy → 工具)     入站 (工具 → Zentropy) │
    │   ─────────────────────     ───────────────────── │
    │   handoff/ready  ★核心      capture(thought)      │
    │   knowledge/{path}          capture(exec_plan)    │
    │   saga/{product}            capture(result)       │
    │   memory/bias               consult_coach         │
    │   areas                     search                │
    │   context/now               save_knowledge        │
    │                                                    │
    └─────────────────┬──────────────┬──────────────────┘
                      │              │
           ┌──────────┴──────────────┴────────┐
           │       External AI Tools           │
           │  Claude Code · Cursor · Desktop   │
           │  (擁有 domain-specific context)    │
           └──────────────────────────────────┘
```

**5 Tools（入站）+ 7 Resources（出站）+ 4 Prompts**

---

## 5. Resources（出站）— Zentropy 的感知層

Resources 是 MCP 的**主角**。它們讓任何外部 AI 在開啟 session 時自動獲得 Zentropy 的全局意識，無需用戶觸發任何動作。

### 5.1 `zentropy://handoff/ready` ★ 核心 Resource

**這是整個 MCP 最重要的一個 resource。** 它不是「今日計畫」，而是「準備好被執行的意圖交接包」。

```yaml
uri: "zentropy://handoff/ready"
scope: read:tasks + read:knowledge
mime_type: application/json
```

```json
{
  "generated_at": "2026-02-13T08:30:00Z",
  "handoff_items": [
    {
      "id": "act_001",
      "intent": "重構 auth 模組，改用 async middleware",
      "priority": "high",
      "due": "2026-02-14",
      "status": "active",
      "context_package": {
        "why": "效能瓶頸，同步呼叫造成 P95 延遲 > 2s",
        "decisions": [
          {
            "id": "dec_045",
            "summary": "ADR-005: 採用 middleware pattern 而非 decorator",
            "date": "2026-02-01"
          }
        ],
        "related_knowledge": [
          "zentropy://knowledge/Work/Zentropy/Architecture/Auth_Design"
        ],
        "coach_notes": "你在 refactor 類任務平均低估 1.8 倍，建議預留 7h 而非 4h",
        "acceptance_criteria": [
          "P95 延遲 < 500ms",
          "現有測試全過",
          "不改變外部 API 介面"
        ]
      },
      "execution_hints": {
        "suggested_tool": "claude_code",
        "suggested_first_step": "先讀 auth 相關檔案，理解現狀後再拆子任務"
      }
    },
    {
      "id": "act_002",
      "intent": "Review PR #45: Librarian 規則引擎重構",
      "priority": "medium",
      "due": "2026-02-13",
      "context_package": {
        "why": "阻擋 M2 開發，PR 已等待 3 天",
        "related_knowledge": [
          "zentropy://knowledge/Work/Zentropy/Architecture/Librarian_Engine"
        ],
        "coach_notes": "code review 你通常估得準（偏差 1.1x）",
        "acceptance_criteria": [
          "確認規則衝突解析邏輯正確",
          "確認測試覆蓋率 > 80%"
        ]
      }
    }
  ]
}
```

**為什麼這是核心**：

與「今日計畫」的差異：

| | 傳統的「今日計畫」 | `handoff/ready` |
|:--|:-------------|:--------------|
| 格式 | 給人看的摘要 | 給 AI agent 消化的結構化包 |
| 內容 | 任務標題 + 到期日 | 完整意圖：why + 相關決策 + 知識連結 + 偏差校正 + 驗收標準 |
| AI 拿到後 | 只知道「有個任務叫 X」 | 能理解全局脈絡，結合自身 domain context 立刻開工 |
| 類比 | 便利貼 | 工作交接文件 |

**使用場景**：

```
1. 用戶開啟 Claude Code session
2. Claude Code 自動讀取 zentropy://handoff/ready
3. AI 看到 act_001（重構 auth）的完整 context_package
4. AI 結合 codebase 實際狀況，拆出具體子任務
5. 用戶不需要把 Zentropy 的任務手動複製貼上 — 橋已經接好了
```

**Backend 生成邏輯**：
- Coach Agent 每日或按需生成
- 篩選條件：status=active, priority=high/medium, 且有足夠 context
- context_package 由 Librarian 組裝（拉取相關知識和決策）
- coach_notes 由 Coach 基於 Episodic Memory 生成

### 5.2 `zentropy://context/now`

Coach 生成的全局狀態感知。外部 AI 的「環境意識」。

```yaml
uri: "zentropy://context/now"
scope: read:tasks
mime_type: application/json
```

```json
{
  "generated_at": "2026-02-13T08:30:00Z",
  "summary": "今天有 2 項到期，1 項 overdue。開發類任務佔 70% 精力。",
  "open_loops": 5,
  "due_today": 2,
  "overdue": 1,
  "top_priorities": ["act_001", "act_002"],
  "calendar_conflicts": [],
  "stalled_items": [
    {
      "id": "act_032",
      "title": "聯繫法律顧問",
      "stalled_days": 16
    }
  ],
  "coach_message": "MCP 設計文件是最高優先。你在設計任務上低估 2.1 倍，今天預留足夠時間。",
  "estimation_bias": {
    "overall": 1.4,
    "by_type": {
      "design": 2.1,
      "development": 1.0,
      "review": 1.1
    }
  }
}
```

**與 `handoff/ready` 的分工**：
- `context/now` = 「全局儀表板」— 知道世界的狀態
- `handoff/ready` = 「工作交接包」— 知道接下來要做的每件事的完整脈絡

### 5.3 `zentropy://knowledge/{area}/{product}/{topic}` ✅ 已實作

知識庫文件。保留不變。

### 5.4 `zentropy://saga/{product_id}` ✅ 已實作

Rolling Saga（前情提要）。保留不變。

### 5.5 `zentropy://memory/bias`

個人估時偏差數據。讓外部 AI 在協助用戶估時時自動校正。

```yaml
uri: "zentropy://memory/bias"
scope: read:profile
mime_type: application/json
```

```json
{
  "overall_bias_ratio": 1.4,
  "by_type": {
    "design":      { "bias": 2.1, "sample_size": 8,  "trend": "stable" },
    "development": { "bias": 1.0, "sample_size": 15, "trend": "improving" },
    "review":      { "bias": 1.1, "sample_size": 12, "trend": "stable" },
    "meeting":     { "bias": 1.3, "sample_size": 10, "trend": "stable" },
    "writing":     { "bias": 1.6, "sample_size": 5,  "trend": "insufficient_data" }
  },
  "insight": "設計任務持續低估，建議預設乘以 2x。開發類已校準。"
}
```

### 5.6 `zentropy://areas`

用戶的角色/資產/主題階層結構。讓外部 AI 理解「這個用戶是誰」。

```yaml
uri: "zentropy://areas"
scope: read:tasks
mime_type: application/json
```

```json
{
  "areas": [
    {
      "name": "Work",
      "products": [
        {
          "name": "Zentropy",
          "topics": ["Architecture", "Frontend", "DevOps", "MCP"],
          "active_actions": 12,
          "status": "active"
        },
        {
          "name": "Client-A Project",
          "topics": ["API Integration", "Testing"],
          "active_actions": 5,
          "status": "active"
        }
      ]
    },
    {
      "name": "Personal",
      "products": [
        {
          "name": "Health",
          "topics": ["Exercise", "Sleep"],
          "active_actions": 2,
          "status": "maintain"
        }
      ]
    }
  ]
}
```

### 5.7 `zentropy://profile/bias-vector` ✅ 已實作

用戶的分類偏好。保留不變。

---

## 6. Tools（入站）— 最小必要的回流管道

只保留**必須是主動動作**的 tool。按 Agent 歸屬設計，而非按 CRUD 操作設計。

### 6.0 設計總覽

| Agent | Tool | 做什麼 | Scope |
|:------|:-----|:------|:------|
| **Gatekeeper** | `capture` | 統一入口——接住一切輸入 | `write:inbox` |
| **Coach** | `consult_coach` | 諮詢教練——refine / challenge / estimate | `trigger:coach` |
| **Coach** | `report_done` | 報告完成——閉環 + 偏差學習 | `write:inbox` |
| **Librarian** | `search` | 語意搜尋 | `read:tasks` |
| **Librarian** | `save_knowledge` | 寫入知識庫 | `write:knowledge` |

**5 個 Tools。**

### 6.1 `capture` — Gatekeeper 的統一入口

取代原本的 `capture_thought`。不再區分 thought/decision/execution_result — Gatekeeper 自己判斷類型和去向。

增加 `mode` 參數支援結構化回流（工具 → Zentropy 的關鍵通道）。

```yaml
name: capture
scope: write:inbox
description: |
  統一入口 — 丟進來就好。
  自由文字、決策紀錄、執行工具的子任務拆解、執行結果——
  Gatekeeper 會自動判斷類型，Librarian 會自動歸檔。
arguments:
  content:
    type: string
    required: true
    max: 50000
    description: "內容（自由文字或 JSON 結構化內容）"
  source:
    type: string
    required: true
    description: "來源（Claude Code, Cursor, Claude Desktop, API）"
  mode:
    type: enum
    values:
      - thought         # 隨手記（預設）
      - execution_plan  # 執行工具產生的子任務拆解
      - result          # 執行結果回報
    required: false
    default: thought
    description: |
      thought: 自由文字，Gatekeeper 自動分類
      execution_plan: 結構化的子任務拆解，需包含 parent_id
      result: 執行結果回報，需包含 parent_id + outcome
  parent_id:
    type: string
    required: false
    description: "關聯的父級 action ID（execution_plan 和 result 模式必填）"
  context_hint:
    type: string
    max: 200
    required: false
    description: "語意提示（Area/Product），幫助 Gatekeeper 分類"
backend_endpoint: POST /api/brain-dump
```

**三種模式的場景**：

**`thought` 模式**（預設）— 取代原 `capture_thought`：

```
用戶在 Claude Desktop 聊天：「我覺得 auth 模組應該改成 async」
→ capture(content="auth 模組應該改成 async...", mode=thought)
→ Gatekeeper 識別為想法，歸到 Work/Zentropy/Architecture
→ Librarian 關聯到 act_001
```

**`execution_plan` 模式** — 工具產生的子任務回流（★ 橋的核心場景）：

```
1. Claude Code 讀取 zentropy://handoff/ready
2. 看到 act_001「重構 auth 模組」+ 完整 context
3. Claude Code 結合 codebase 拆出子任務
4. 呼叫：
   capture(
     mode = "execution_plan",
     parent_id = "act_001",
     source = "Claude Code",
     content = JSON.stringify({
       "sub_items": [
         { "title": "將 auth.ts middleware 改為 async", "estimated_minutes": 60 },
         { "title": "更新 3 個依賴的 route handler", "estimated_minutes": 90 },
         { "title": "修改測試 mock", "estimated_minutes": 45 },
         { "title": "跑 benchmark 確認效能改善", "estimated_minutes": 30 },
         { "title": "更新 API 文件", "estimated_minutes": 15 }
       ],
       "total_estimated_minutes": 240,
       "codebase_context": "涉及 auth.ts + 3 個 route files + test/"
     })
   )
5. Gatekeeper 識別為 execution_plan → 建立子任務掛在 act_001 下
6. Coach 更新估時（原估 4h → 工具拆解後 4h，但加上偏差因子建議 7h）
7. 下次用戶看 Zentropy，act_001 已經有完整的 sub-items
```

**`result` 模式** — 執行結果回流：

```
1. 用戶在 Claude Code 完成了 auth.ts 的重構
2. Claude Code 呼叫：
   capture(
     mode = "result",
     parent_id = "act_001",
     source = "Claude Code",
     content = JSON.stringify({
       "outcome": "completed",
       "actual_duration_minutes": 300,
       "notes": "比預期複雜，需要處理 3 個 legacy 相容問題",
       "artifacts": ["PR #67 已提交"]
     })
   )
3. Coach 記錄：estimated=240, actual=300, ratio=1.25
4. Coach 更新 Episodic Memory（refactor 類偏差因子微調）
5. Librarian 歸檔到 History
```

**Response（所有模式統一）**：

```json
{
  "id": "item_xxx",
  "status": "processed",
  "classified_as": "execution_plan",
  "filed_to": { "area": "Work", "product": "Zentropy", "topic": "Architecture" },
  "parent_id": "act_001",
  "agent_actions": [
    "Gatekeeper: 識別為子任務拆解",
    "Librarian: 建立 5 個 sub-items 掛在 act_001 下",
    "Coach: 更新估時 — 總計 240min（校正後建議 420min）"
  ],
  "_warning": null
}
```

### 6.2 `consult_coach` — 向 Coach 提問

統一的 Coach 諮詢介面。用 `intent` 參數區分「想深化」「想被挑戰」「想估時」，而不是拆成三個 tool。

```yaml
name: consult_coach
scope: trigger:coach
description: |
  向 Coach 諮詢 — 可以是深化想法、挑戰計畫、或估時校正。
  Coach 會結合 Episodic Memory 和相關知識提供回饋。
arguments:
  intent:
    type: enum
    values:
      - refine     # 深化模糊想法 → 結構化行動路徑
      - challenge  # 挑戰計畫/假設 → 揭露盲點和風險
      - estimate   # 估時校正 → Reference Class Forecasting
    required: true
    description: "諮詢意圖"
  content:
    type: string
    required: true
    max: 5000
    description: "想法、計畫、或任務描述"
  focus:
    type: string
    required: false
    max: 200
    description: |
      聚焦面向（可選）：
      - refine: 不需要
      - challenge: feasibility / timeline / risk / scope
      - estimate: 任務類型提示（design, development, meeting...）
  user_estimate_minutes:
    type: number
    required: false
    description: "用戶的初始估計（分鐘）— 僅 estimate intent 使用"
backend_endpoint: POST /api/coach/consult
```

**`refine` 意圖 — 思考夥伴**：

```
用戶：「我想做一個 MCP marketplace 讓第三方開發者上架工具」

consult_coach(intent=refine, content="MCP marketplace...")

Coach 回應：
{
  "intent": "refine",
  "analysis": {
    "core_thesis": "你想建立一個平台效應——讓第三方擴展 Zentropy 的 execute 能力",
    "assumptions": [
      "假設: 有足夠的開發者願意為 Zentropy 開發工具",
      "假設: 用戶願意信任第三方工具存取他們的資料"
    ],
    "blind_spots": [
      "安全審核成本——每個第三方工具都需要安全審查",
      "你目前的用戶量能否支撐平台效應？"
    ],
    "similar_history": [
      {
        "item_id": "dec_023",
        "summary": "上次考慮 plugin 系統時，因資源不足而推遲",
        "date": "2025-11-15"
      }
    ],
    "suggested_next_steps": [
      { "action": "先跟 5 個潛在開發者做 user interview", "priority": "high" },
      { "action": "定義最小的 plugin API spec", "priority": "medium" },
      { "action": "評估安全審核流程的成本", "priority": "medium" }
    ]
  },
  "auto_captured_as": "item_xxx"
}
```

**`challenge` 意圖 — 反方質疑**：

```
用戶：「我要兩週內完成 Librarian Engine v2」

consult_coach(intent=challenge, content="兩週內完成 Librarian Engine v2", focus="timeline")

Coach 回應：
{
  "intent": "challenge",
  "challenges": [
    {
      "aspect": "timeline",
      "challenge": "歷史上類似的引擎重構平均花 3.5 週",
      "data": {
        "your_estimate_days": 14,
        "historical_median_days": 24,
        "your_bias_ratio_for_development": 1.0,
        "but": "這是 refactor，不是 greenfield — refactor 偏差是 1.8x"
      },
      "question": "這是 hard deadline 嗎？可以先交付 MVP 子集嗎？"
    },
    {
      "aspect": "scope",
      "challenge": "v2 包含 5 個子系統，其中規則衝突解析是全新的",
      "question": "可以先做 4 個已驗證的子系統，把規則衝突解析放 v2.1 嗎？"
    }
  ],
  "overall_confidence": "low",
  "suggestion": "建議先定義 v2-MVP scope，砍到 2 週可信的範圍，再漸進式交付。"
}
```

**`estimate` 意圖 — Reference Class Forecasting**：

```
consult_coach(
  intent=estimate,
  content="設計新的 API 介面",
  focus="design",
  user_estimate_minutes=120
)

Coach 回應：
{
  "intent": "estimate",
  "reference_class": {
    "similar_tasks_found": 12,
    "distribution": {
      "p25_minutes": 90,
      "median_minutes": 150,
      "p75_minutes": 240,
      "p90_minutes": 360
    }
  },
  "personal_bias": {
    "task_type": "design",
    "bias_ratio": 2.1,
    "sample_size": 8
  },
  "recommendation": {
    "user_estimate_minutes": 120,
    "suggested_minutes": 250,
    "confidence": "medium",
    "reasoning": "你估 2h，但過去 8 次設計任務平均低估 2.1 倍。建議預留 4h。"
  }
}
```

### 6.3 `report_done` — 閉環

獨立於 `capture` 的原因：這是一個**語意明確的動作**——不是「丟東西進來」，而是「宣告完成」。Coach 的處理邏輯完全不同（計算偏差、歸檔、更新記憶）。

```yaml
name: report_done
scope: write:inbox
description: |
  報告一個行動項目完成。Coach 會：
  1. 計算估時偏差（estimated vs actual）
  2. 更新 Episodic Memory（個人偏差因子）
  3. 觸發 Librarian 歸檔
  完成這個閉環是 Zentropy 偏差學習的數據基礎。
arguments:
  action_id:
    type: string
    required: true
    description: "完成的行動 ID"
  actual_duration_minutes:
    type: number
    required: false
    description: "實際花費時間（分鐘）"
  outcome:
    type: enum
    values: [completed, partial, blocked, cancelled]
    required: false
    default: completed
    description: "結果狀態"
  notes:
    type: string
    required: false
    max: 2000
    description: "完成筆記"
backend_endpoint: POST /api/actions/{action_id}/done
```

**Response**：

```json
{
  "action_id": "act_001",
  "status": "completed",
  "completed_at": "2026-02-13T17:30:00Z",
  "deviation": {
    "estimated_minutes": 240,
    "actual_minutes": 300,
    "ratio": 1.25,
    "updated_bias_for_type": {
      "type": "refactor",
      "previous_bias": 1.8,
      "new_bias": 1.73,
      "sample_size": 9
    }
  },
  "coach_feedback": "比估時多 25%，但比你的歷史平均（1.8x）好很多。refactor 能力在進步。",
  "archived": true
}
```

### 6.4 `search` — Librarian 的語意搜尋

即原本的 `query_memory`，重新命名以符合 Agent 語意。

```yaml
name: search
scope: read:tasks
description: "語意搜尋 — 跨知識庫、決策紀錄、行動項目搜尋相關資訊。"
arguments:
  query:
    type: string
    required: true
    max: 500
    description: "自然語言問題"
  scope:
    type: string
    required: false
    max: 200
    description: "限制在特定 Area/Product"
backend_endpoint: GET /api/search
agent: Librarian（Vector Search + User Bias 校正）
```

### 6.5 `save_knowledge` — Librarian 的知識寫入

即原本的 `append_to_knowledge`，重新命名以符合 Agent 語意。

```yaml
name: save_knowledge
scope: write:knowledge
description: "將結構化知識寫入指定的 Reference 區域。"
arguments:
  product_name:
    type: string
    required: true
    max: 200
    description: "目標 Product（伺服器端驗證）"
  topic_name:
    type: string
    required: true
    max: 200
    description: "目標 Topic"
  title:
    type: string
    required: true
    max: 200
    description: "標題"
  content:
    type: string
    required: true
    max: 50000
    description: "內容"
backend_endpoint: POST /api/knowledge
agent: Librarian（自動生成 Embeddings + 更新索引）
```

---

## 7. Prompts

### 現有（保留）

| Name | 說明 |
|:-----|:-----|
| `summarize-for-zentropy` | 將對話整理為 Rolling Summary 格式 |
| `generate-spec-structure` | 生成 Spec 文件結構 |

### 新增

#### `plan-next-actions`

```yaml
name: plan-next-actions
description: "根據當前脈絡，生成下一步行動建議（適合回流到 Zentropy）"
arguments:
  context: { type: string, description: "當前工作脈絡" }
  product: { type: string, optional: true }
template: |
  基於以下脈絡，識別具體的下一步行動：

  脈絡：{context}
  產品：{product}

  要求：
  1. 每個行動必須可在 2 小時內完成
  2. 標明優先級 (urgent/high/medium/low)
  3. 標明依賴順序
  4. 估計時間

  輸出 JSON 格式（可直接用於 capture mode=execution_plan）：
  {
    "sub_items": [
      { "title": "...", "estimated_minutes": N, "priority": "...", "depends_on": [] }
    ]
  }
```

#### `write-decision-record`

```yaml
name: write-decision-record
description: "將討論結構化為決策紀錄（ADR 格式，可直接用於 capture）"
arguments:
  discussion: { type: string, description: "決策討論內容" }
template: |
  將以下討論整理為 Zentropy ADR 格式：

  {discussion}

  輸出：
  # ADR: [標題]
  ## 背景 (Context)
  ## 決策 (Decision)
  ## 理由 (Rationale)
  ## 替代方案 (Alternatives Considered)
  ## 後果 (Consequences)
```

---

## 8. OAuth Scopes

### 完整 Scope 表

| Scope | 說明 | 使用者 |
|:------|:-----|:------|
| `read:tasks` | 讀取任務、行動項目、handoff | Resources: handoff/ready, context/now, areas |
| `read:knowledge` | 讀取知識庫 | Resources: knowledge/*, saga/* |
| `read:profile` | 讀取用戶偏好與偏差數據 | Resources: profile/*, memory/bias |
| `write:inbox` | 寫入（capture + report_done） | Tools: capture, report_done |
| `write:knowledge` | 寫入知識庫 | Tools: save_knowledge |
| `trigger:coach` | 觸發 Coach Agent | Tools: consult_coach |

**注意**：相比 v1.0 設計，移除了 `write:actions`, `read:plan`, `read:review`, `write:execution`。原因：

- `write:actions` → 由 `write:inbox` 覆蓋（capture mode=execution_plan 由 Gatekeeper 建立 actions）
- `read:plan` / `read:review` → 併入 `read:tasks`（handoff/ready 和 context/now 本質是 task 的衍生物）
- `write:execution` → 移除（Phase 3 再評估是否需要日曆代理）

### Scope 組合建議

| 模式 | Scopes | 場景 |
|:-----|:-------|:-----|
| **唯讀** | `read:tasks read:knowledge` | Cursor 讀 context coding |
| **捕捉** | 唯讀 + `write:inbox` | Claude Desktop 隨手記 + 回報結果 |
| **教練** | 捕捉 + `trigger:coach read:profile` | Claude Desktop 做規劃 + 諮詢 Coach |
| **完整** | 全部 | 完全信任的 client |

---

## 9. 端到端場景

### 9.1 開發場景：從意圖到程式碼再回來

```
Phase 1: 意圖形成（在 Claude Desktop / App）
─────────────────────────────────────────────
用戶：「auth 模組效能有問題，需要重構成 async」
→ capture(mode=thought, content="auth 效能問題...")
→ Gatekeeper 歸類到 Work/Zentropy/Architecture
→ Coach 自動估時（refactor 類 × 偏差 1.8x）
→ 任務進入 handoff/ready

Phase 2: 交接到執行工具（在 Claude Code）
─────────────────────────────────────────────
用戶打開 Claude Code
→ AI 讀取 zentropy://handoff/ready
→ 看到 act_001 + 完整 context_package
→ AI：「你有個高優先的 auth 重構任務，讓我先看看 codebase」
→ AI 閱讀 auth 相關檔案，拆出 5 個子任務
→ capture(mode=execution_plan, parent_id="act_001", content={sub_items...})
→ 子任務回流到 Zentropy

Phase 3: 執行（在 Claude Code）
─────────────────────────────────────────────
用戶與 Claude Code 一起完成重構
（Zentropy 不介入這個階段——這是工具的 domain）

Phase 4: 閉環（在 Claude Code 或 App）
─────────────────────────────────────────────
→ report_done(action_id="act_001", actual_duration_minutes=300)
→ Coach 計算偏差：estimated=240, actual=300, ratio=1.25
→ Coach 更新 Episodic Memory
→ Librarian 歸檔到 History
→ 下次重構任務的估時會更準
```

### 9.2 跨領域場景：法律事務

```
Phase 1: 意圖形成
用戶：「合約需要在週五前審完」
→ capture → Gatekeeper 歸到 Work/Client-A/Compliance
→ Coach: 「你法律類任務偏差 1.6x，建議今天就開始」

Phase 2: 交接
用戶打開法律文件 AI 工具（如 Claude + PDF）
→ AI 讀取 zentropy://handoff/ready
→ 看到合約審閱任務 + context（為什麼要審、關鍵條款、歷史決策）
→ AI 結合合約 PDF 內容，列出審閱要點
→ capture(mode=execution_plan, parent_id="act_055", content={sub_items...})

Phase 3: 執行
用戶審閱合約，標記關鍵條款

Phase 4: 閉環
→ report_done(action_id="act_055", notes="發現第 7 條有風險")
→ Coach 更新法律類偏差因子
```

### 9.3 反向場景：工具 → Zentropy

```
用戶在 Claude Code 寫完程式後，發現了一些新的待辦事項：

Claude Code：
「基於今天的開發，我建議以下後續工作：
 1. 效能測試需要在 staging 環境跑一輪
 2. API 文件需要更新
 3. 應該通知 Client-A 這個改動可能影響他們的整合」

→ capture(mode=execution_plan, source="Claude Code", content={
    sub_items: [
      { title: "staging 環境效能測試", estimated_minutes: 60, priority: "high" },
      { title: "更新 API 文件", estimated_minutes: 30, priority: "medium" },
      { title: "通知 Client-A 整合影響", estimated_minutes: 15, priority: "high" }
    ]
  })

→ Gatekeeper: 自動歸類（前 2 個到 Zentropy/DevOps，第 3 個到 Client-A/Communication）
→ Coach: 加入估時校正，更新 context/now
→ 下次用戶打開任何 AI 工具，這些新任務已在 handoff/ready 裡
```

---

## 10. 實作分期

### Phase 1 — 完整的橋 (M2)

**目標**：建立完整的 意圖 → 交接 → 回流 → 閉環。Phase 1 結束時用戶可以體驗 Appendix A 中 **5/8** 的場景（A.1, A.2, A.3, A.5, A.6）。

| 項目 | 類型 | 優先級 | 說明 |
|:-----|:-----|:-------|:-----|
| `zentropy://handoff/ready` | Resource | **P0** | 整個 MCP 的靈魂 |
| `zentropy://context/now` | Resource | **P0** | AI 的環境意識 |
| `zentropy://memory/bias` | Resource | **P0** | 偏差數據——handoff/ready 的 coach_notes 和 report_done 的回饋都需要 |
| `zentropy://areas` | Resource | **P0** | AI 理解用戶結構 |
| `capture` (統一入口) | Tool | **P0** | 取代 capture_thought，支援 3 種 mode |
| `report_done` | Tool | **P0** | 閉環關鍵 |
| `search` | Tool | **P0** | 重新命名 query_memory |
| `save_knowledge` | Tool | **P0** | 重新命名 append_to_knowledge |

**Backend 需新建**：
- `GET /api/handoff/ready` — Coach + Librarian 組裝交接包
- `GET /api/context/now` — 全局狀態摘要
- `GET /api/memory/bias` — 暴露校準數據
- `GET /api/areas` — 階層結構
- `POST /api/actions/{id}/done` — Coach 偏差計算 + Librarian 歸檔
- `POST /api/brain-dump` 擴展 — 支援 execution_plan / result mode

**遷移**：`capture_thought` → `capture`, `query_memory` → `search`, `append_to_knowledge` → `save_knowledge`（保持向後相容，舊名稱標記 deprecated）

**場景覆蓋**：

| 場景 | 核心需求 | Phase 1 覆蓋 |
|:-----|:--------|:------------|
| A.1 Claude Code 自動獲得任務脈絡 | `handoff/ready` | ✅ |
| A.2 Claude Code 拆任務回流 | `handoff/ready` + `capture(execution_plan)` | ✅ |
| A.3 Claude Desktop 隨手記 | `capture(thought)` | ✅ |
| A.4 諮詢 Coach 校正估時 | `consult_coach(estimate)` | ❌ Phase 2 |
| A.5 完成任務追蹤偏差 | `report_done` + `memory/bias` | ✅ |
| A.6 Cursor 自動參考知識庫 | `knowledge/*` + `handoff/ready` | ✅ |
| A.7 Coach 挑戰計畫 | `consult_coach(challenge)` | ❌ Phase 2 |
| A.8 想法深化 | `consult_coach(refine)` | ❌ Phase 2 |

### Phase 2 — Coach 智慧 (M2 ~ M3)

**目標**：覆蓋剩餘 **3/8** 場景（A.4, A.7, A.8）。

| 項目 | 類型 | 優先級 | 說明 |
|:-----|:-----|:-------|:-----|
| `consult_coach` | Tool | **P1** | Refine + Challenge + Estimate 統一介面 |
| `plan-next-actions` | Prompt | **P1** | 行動規劃模板 |
| `write-decision-record` | Prompt | **P1** | ADR 生成模板 |

**Backend 需新建**：
- `POST /api/coach/consult` — Coach Agent 的統一諮詢端點
- Episodic Memory 儲存與檢索層

### Phase 3 — 生態擴展 (M3+)

根據用戶回饋決定方向：

| 候選 | 條件 |
|:-----|:-----|
| 日曆代理 (`proxy_calendar_event`) | 用戶訪談確認需求強度 |
| 通知推送 | 確認推送管道（WhatsApp? Telegram? Slack?） |
| 第三方工具整合指南 | 讓其他開發者能為 Zentropy 寫 MCP adapter |

---

## 11. 與競品的差異化

| 維度 | Todoist MCP | Linear MCP | Heptabase MCP | OpenClaw | **Zentropy MCP** |
|:-----|:-----------|:-----------|:-------------|:---------|:----------------|
| **本質** | Task DB API | Issue DB API | Knowledge DB API | 通用 Agent | **意圖-執行的橋** |
| **Tool 數量** | 19 | 40+ | 9 | N/A | **5** |
| **出站品質** | 任務標題+到期日 | Issue 詳情 | 語意搜尋 | 通用 memory | **結構化意圖交接包** |
| **入站智慧** | 直接寫 DB | 直接寫 DB | 只能寫 inbox | LLM 判斷 | **Agent-mediated 3 模式** |
| **閉環** | ❌ | ❌ | ❌ | ❌ | ✅ **偏差學習** |
| **Thought Partner** | ❌ | ❌ | ❌ | ❌ | ✅ **consult_coach** |
| **估時校正** | ❌ | ❌ | ❌ | ❌ | ✅ **Reference Class** |

**一句話差異**：

> 其他 MCP 暴露的是 database。Zentropy MCP 暴露的是 intelligence — 三個 Agent 的判斷力，包裝成一座連接意圖與執行的橋。

---

## 12. 現有 Coach 實作 vs MCP v2.0 差距分析

> 基於 2026-02-13 merge main 後的代碼審查。

### 12.1 已完整實作的 Coach 能力

以下能力已 production-ready，可直接作為 MCP 層的後端基礎：

| 能力 | 關鍵檔案 | 可支撐的 MCP 功能 |
|:-----|:---------|:----------------|
| **晨報/晚報生成** | `generate-briefing.ts` + `coach-ai-generator.ts` | `context/now` Resource |
| **每日計畫生成** | `generate-plan.ts` + `coach-plan-generator.ts` | `handoff/ready` Resource（部分） |
| **7 條平行資料聚合** | `coach-data-aggregator.ts` | `context/now` + `handoff/ready` 的數據來源 |
| **衝突偵測（3 類）** | `coach-detection.ts` | `context/now` 的 conflicts 欄位 |
| **停滯偵測（2 類）** | `coach-detection.ts` | `context/now` 的 stalled_items 欄位 |
| **估時偏差追蹤** | `coach-calibration.ts` | `memory/bias` Resource |
| **校準注入 AI prompt** | `generate-plan.ts` → `coach-plan-generator.ts` | `consult_coach(estimate)` 的基礎 |
| **Cron 自動排程** | `cron/coach-briefing/route.ts` | 自動化生成 |
| **計畫項目完成連動** | `update-plan-item.ts` | `report_done` 的基礎 |
| **actual_minutes 全鏈路** | Schema → Repo → UseCase → Calibration → AI | 偏差學習的完整數據管線 |

### 12.2 關鍵數據管線驗證

**actual_minutes 完整鏈路**（偏差學習的基礎）：

```
用戶完成任務 → PATCH /api/coach/plan/items/:id {actualMinutes: 300}
  → UpdatePlanItemUseCase 驗證 (0-1440) 並儲存
  → daily_plan_items.actual_minutes = 300
  → 下次 GeneratePlanUseCase 執行時：
    → CoachCalibration.getCalibrationNote() 查詢最近 100 筆完成紀錄
    → 計算 sum(actual) / sum(estimated) = overall ratio
    → 計算 per-area ratios（需 ≥ 3 樣本）
    → 生成校準建議（如「你在設計類低估 2.1 倍」）
    → 注入 CoachPlanGenerator 的 AI prompt
    → AI 調整估時
```

**計畫重新生成時的數據保護**：
```typescript
// prisma-daily-plan-repository.ts
// 只刪除未完成項目，已完成項目（含 actual_minutes）永遠保留
await prisma.dailyPlanItem.deleteMany({
  where: { plan_id: existing.id, completed: false },
})
```

**估時回寫保護**：
```typescript
// generate-plan.ts
// 只在原始值為 null 時回寫，不覆蓋用戶手動值
if (candidate.estimatedMinutes !== null) continue
```

### 12.3 差距矩陣

| MCP v2.0 需求 | 狀態 | 後端基礎 | 還需要做什麼 |
|:-------------|:-----|:--------|:-----------|
| **Resources** | | | |
| `handoff/ready` ★ | 🟡 部分 | DailyPlan 有結構化數據 + ordering + reasoning | 需組裝 context_package（why, decisions, knowledge links, coach_notes, acceptance_criteria）；需新 endpoint `GET /api/handoff/ready` |
| `context/now` | 🔴 未實作 | CoachDataAggregator 已能產出所有數據 | 需新 endpoint `GET /api/context/now`，組裝全局摘要 + open_loops + stalled_items + estimation_bias |
| `memory/bias` | 🔴 未實作 | CoachCalibration 已能計算比率 | 需新 endpoint `GET /api/memory/bias`，暴露現有校準數據 |
| `areas` | 🔴 未實作 | Prisma 有 Area/Product/Topic 模型 | 需新 endpoint `GET /api/areas`，組裝階層結構 |
| `knowledge/*` | ✅ 已實作 | — | — |
| `saga/*` | ✅ 已實作 | — | — |
| `profile/bias-vector` | ✅ 已實作 | — | — |
| **Tools** | | | |
| `capture` (統一入口) | 🟡 部分 | `POST /api/brain-dump` 已存在 | 需擴展支援 mode=execution_plan/result，需處理 parent_id 掛載 |
| `report_done` | 🔴 未實作 | `UpdatePlanItemUseCase` 有 actualMinutes 和完成連動 | 需新 endpoint `POST /api/actions/:id/done`，整合 Coach 偏差計算 + Librarian 歸檔 |
| `consult_coach` | 🔴 未實作 | 偵測引擎 + 校準服務已就緒 | 需新 endpoint `POST /api/coach/consult`，需新 AI prompt 模板支援 refine/challenge/estimate |
| `search` | 🟡 部分 | `query_memory` 已存在 | 重新命名 + 增強語意搜尋 |
| `save_knowledge` | 🟡 部分 | `append_to_knowledge` 已存在 | 重新命名 |

### 12.4 複用 vs 新建評估

**可直接複用（包裝即可）**：
- `CoachDataAggregator` → `context/now` 的數據層（7 條平行查詢完全可用）
- `CoachCalibration` → `memory/bias` 的數據層（計算邏輯完整）
- `DailyPlan + DailyPlanItem` → `handoff/ready` 的基礎結構
- `coach-detection.ts` → `context/now` 的衝突/停滯資訊
- `UpdatePlanItemUseCase` → `report_done` 的完成連動邏輯

**需要新建**：
- `handoff/ready` 的 context_package 組裝邏輯（需整合 Librarian 的知識連結 + 決策查詢）
- `consult_coach` 的 3 種 intent AI prompt 模板
- `consult_coach` 的 similar_history 查詢（需跨知識庫和歷史任務搜尋）
- `report_done` 的即時偏差回饋生成
- `capture` 的 execution_plan/result 模式處理邏輯
- MCP Server 的 Resource handler 註冊

---

## 13. 具體實作計畫：MCP 包裝層

> 基於 §12 的差距分析，以下是 MCP 層各 function 的具體實作規劃。

### 13.1 Phase 1 — 完整的橋（3-4 週）

**目標**：建立完整的 意圖 → 交接 → 回流 → 閉環。Phase 1 結束時用戶可體驗 5/8 場景。

> **為什麼不再分 1A/1B**：場景驗證顯示，原 Phase 1A（context/now + memory/bias + areas + report_done）只能實現 A.5 一個場景。用戶最有感的核心體驗「打開工具就知道該做什麼 + 做完自動回流」（A.1 + A.2）需要 `handoff/ready` + `capture` 增強，這些在原 Phase 1B。分開交付意味著用戶要等兩個 sprint 才能感受到 MCP 的價值——這不可接受。

**建議實作順序**：先做基礎層（Week 1-2），再做核心橋（Week 3-4）。基礎層為核心橋提供數據依賴。

---

#### Week 1-2：基礎層

基礎層的 Resource 和 Tool 大多是「包裝已有能力」，實作成本低，且為 Week 3-4 的核心橋提供必要的數據基礎。

##### 13.1.1 `zentropy://context/now` Resource

**為什麼先做**：這是最容易實作的 Resource，因為 `CoachDataAggregator` + `CoachCalibration` 已經能產出所有需要的數據。

**後端 endpoint**：`GET /api/context/now`

**實作方式**：
```
CoachDataAggregator.aggregate(userId)  // 已有：7 條平行查詢
  + detectTimeOverlaps()               // 已有
  + detectDeadlineCollisions()          // 已有
  + detectCapacityOverload()            // 已有
  + detectStagnantProducts()            // 已有
  + detectStuckTasks()                  // 已有
  + CoachCalibration.calculate(userId)  // 已有（需從 private → 暴露）
  → 組裝成 context/now JSON 格式
```

**新代碼量估計**：~100 行（主要是組裝和格式轉換）

##### 13.1.2 `zentropy://memory/bias` Resource

**為什麼同時做**：`CoachCalibration` 已經能算出所有數據，只需暴露。且 `handoff/ready` 的 coach_notes 和 `report_done` 的偏差回饋都依賴這個數據。

**後端 endpoint**：`GET /api/memory/bias`

**實作方式**：
```
CoachCalibration.calculate(userId)  // 已有（需 public 化）
  → 轉換為 memory/bias JSON 格式
  → 加上 trend 計算（目前 trend 已計算但未暴露）
```

**新代碼量估計**：~50 行

##### 13.1.3 `zentropy://areas` Resource

**後端 endpoint**：`GET /api/areas`

**實作方式**：
```
Prisma 查詢：Areas → Products → Topics（含 active_actions count）
  → 組裝階層結構 JSON
```

**新代碼量估計**：~80 行

##### 13.1.4 `report_done` Tool

**為什麼不能等**：這是閉環的關鍵。沒有它，偏差學習的數據來源就斷了。A.5 場景的核心。

**後端 endpoint**：`POST /api/actions/:id/done`

**實作方式**：
```
1. 查找 action（Task 或 SubTask）
2. 如果是 DailyPlanItem → 複用 UpdatePlanItemUseCase 的完成連動
3. 計算即時偏差：CoachCalibration.calculate() 取 estimated，對比 actual
4. 更新 Task/SubTask 狀態為完成
5. 生成 coach_feedback（AI 或模板）
6. 返回 deviation + coach_feedback
```

**新代碼量估計**：~200 行（新 Use Case + endpoint）

##### 13.1.5 `search` + `save_knowledge` Tool 重新命名

**實作方式**：
- `query_memory` → `search`（新增 alias，保留舊名 deprecated）
- `append_to_knowledge` → `save_knowledge`（同上）
- MCP Server 註冊新名稱

**新代碼量估計**：~50 行

##### 13.1.6 MCP Server 基礎層 Handler 註冊

**實作方式**：在 `api/src/mcp/server.ts` 註冊 context/now、memory/bias、areas 的 Resource handlers + report_done Tool handler。

**新代碼量估計**：~150 行

**基礎層小計**：~630 行新代碼

---

#### Week 3-4：核心橋

核心橋是 MCP 最重要的差異化功能——結構化意圖交接（出站）和子任務回流（入站）。這是 A.1 和 A.2 場景的基礎。

##### 13.1.7 `zentropy://handoff/ready` Resource ★

**這是整個 Phase 1 最重要、也最複雜的一個項目。** 需要整合多個資料源組裝 context_package。

**後端 endpoint**：`GET /api/handoff/ready`

**組裝邏輯**：
```
1. 取今日 DailyPlan（已有 GeneratePlanUseCase）
2. 對每個 plan item：
   a. 取 Task 詳情 + Product + Area 脈絡
   b. 取相關知識連結（Librarian 查詢）         ← 需新建
   c. 取相關決策紀錄（Knowledge 查詢）          ← 需新建
   d. 取 coach_notes（CoachCalibration 偏差）   ← 已有（Week 1-2 已暴露）
   e. 取 acceptance_criteria（Task metadata）   ← 需確認 schema
3. 包裝成 handoff_items[] 格式
```

**依賴**：
- Week 1-2 的 `memory/bias`（提供 coach_notes 的數據）
- Librarian 的知識檢索能力（語意搜尋 or keyword matching）

**新代碼量估計**：~300 行（新 Use Case + Knowledge 查詢 + 組裝邏輯）

##### 13.1.8 `capture` Tool 增強

**擴展 `POST /api/brain-dump`**：

```
新增 mode 參數處理：
- thought（已有）：走現有 Gatekeeper 流程
- execution_plan（新建）：
  1. 解析 content 中的 sub_items JSON
  2. 查找 parent_id 對應的 Task
  3. 建立 SubTask 掛在 parent Task 下
  4. Coach 更新估時（校準因子）
- result（新建）：
  1. 解析 outcome + actual_duration_minutes
  2. 複用 report_done 邏輯（Week 1-2 已實作）
  3. Librarian 歸檔到 History
```

**新代碼量估計**：~250 行

##### 13.1.9 MCP Server 核心橋 Handler 註冊

**實作方式**：在 `api/src/mcp/server.ts` 註冊 handoff/ready Resource handler + 更新 capture Tool handler 支援新 mode。

**新代碼量估計**：~100 行

**核心橋小計**：~650 行新代碼

**Phase 1 總計**：~1,280 行新代碼

---

### 13.2 Phase 2 — Coach 智慧（2-3 週）

#### 13.2.1 `consult_coach` Tool

**後端 endpoint**：`POST /api/coach/consult`

**三個 intent 的實作策略**：

| Intent | AI Prompt 策略 | 數據來源 |
|:-------|:-------------|:--------|
| `refine` | 新 prompt 模板：假設分析 + 盲點偵測 + 歷史參照 | Task 歷史、Knowledge 搜尋、相關決策 |
| `challenge` | 新 prompt 模板：反方論述 + 數據支撐 | CoachCalibration 偏差 + 歷史任務 + 衝突偵測 |
| `estimate` | 擴展現有 CoachCalibration | CoachCalibration + per-area 分佈（需新增 percentile 計算） |

**新代碼量估計**：~500 行（新 Use Case + 3 套 prompt + AI 呼叫）

#### 13.2.2 Episodic Memory 增強

**現狀**：CoachCalibration 只按 area 分組，不按 task type 分組。

**增強方向**：
- 在 `daily_plan_items` 增加 `task_type` 欄位（或從 task metadata 推斷）
- CoachCalibration 增加 per-task-type 分組計算
- 增加 percentile 分佈（p25/p50/p75/p90）
- 增加 trend 計算（近 10 筆 vs 全部）

**新代碼量估計**：~200 行（擴展 CoachCalibration + migration）

### 13.3 實作優先級總覽

```
Phase 1（完整的橋）— 3-4 週，覆蓋 5/8 場景
│
├── Week 1-2：基礎層 ................. ~630 行
│   ├── context/now Resource .......... 容易（組裝已有數據）
│   ├── memory/bias Resource .......... 容易（暴露已有計算）
│   ├── areas Resource ................ 容易（Prisma 查詢）
│   ├── report_done Tool .............. 中等（新 Use Case）
│   ├── search/save_knowledge 重命名 .. 容易（alias）
│   └── MCP Server 基礎層註冊 ........ 容易（接線）
│
└── Week 3-4：核心橋 ................. ~650 行
    ├── handoff/ready Resource ★ ..... 困難（需整合多資料源）
    ├── capture 增強 ................. 中等（擴展現有 endpoint）
    └── MCP Server 核心橋註冊 ........ 容易（接線）

Phase 2（Coach 智慧）— 2-3 週，覆蓋 3/8 場景
├── consult_coach Tool ............... 困難（3 套 AI prompt）
└── Episodic Memory 增強 ............. 中等（擴展校準服務）
```

---

## 14. 設計決策記錄

### DDR-001: 為什麼是 5 個 Tools 而非 15 個？

**v1.0 設計**（已棄用）按功能列了 15 個 Tools（capture_thought, capture_decision, capture_execution_result, list_items, refine_idea, challenge_plan, plan_action, complete_action, update_action, get_daily_plan, estimate_with_history, get_briefing, get_weekly_review, detect_conflicts, proxy_calendar_event）。

**問題**：
1. 本質上是「Todoist API + AI 功能」——CRUD 端點的包裝
2. 讀取類 Tools（get_briefing, get_daily_plan）應該是 Resource（被動注入更符合環境智慧）
3. 細分的 capture（thought / decision / result）增加了 AI 選擇的認知負擔——Gatekeeper 存在的意義就是「你不需要分類，丟進來就好」
4. 15 個 tools 違反了 Obsidian semantic MCP 的啟發：「語意明確 > 功能齊全」

**v2.0 決策**：
- 讀取 → Resource（handoff/ready, context/now）
- 所有寫入 → 統一入口 `capture`（Gatekeeper 負責分類）
- Coach 能力 → 統一入口 `consult_coach`（intent 參數區分）
- 閉環 → 獨立的 `report_done`（語意足夠明確且 Coach 處理邏輯完全不同）

### DDR-002: 為什麼 `handoff/ready` 是核心而非 `context/now`？

`context/now` 是「你今天有什麼」——這是所有生產力工具都做的事。
`handoff/ready` 是「這件事的完整脈絡，拿去就能做」——這是沒有產品做的事。

差距在於：一個 AI 在 Cursor 裡讀到「你有個 auth 重構任務」vs 讀到「auth 重構任務 + 為什麼要做 + 過去的相關決策 + 你在這類任務上的偏差 + 驗收標準」——後者才是真正消除意圖-執行摩擦的交接。

### DDR-003: 為什麼 `capture` 要支援 execution_plan mode？

這是「橋」的雙向性的關鍵。沒有 execution_plan mode，資訊只能從 Zentropy 流到工具，不能從工具流回來。

場景：Claude Code 基於 codebase 拆了 5 個子任務。如果沒有 execution_plan mode：
- 這 5 個子任務留在 Claude Code session 裡，session 結束就消失
- 用戶下次打開 Zentropy 看不到這些細節
- Coach 無法追蹤這些子任務的完成情況

有了 execution_plan mode：
- 子任務回流到 Zentropy，掛在父任務下
- Zentropy 成為所有 AI 工具的「共享記憶」
- Coach 能追蹤每個子任務的完成情況和偏差

### DDR-004: 為什麼合併 Phase 1A/1B？

**原設計**：Phase 1A（1-2 週）= context/now + memory/bias + areas + report_done；Phase 1B（1-2 週）= handoff/ready + capture 增強。

**問題**：用 Appendix A 的 8 個場景驗證後發現，Phase 1A 只能完整實現 **A.5 一個場景**（1/8）。用戶最有感的核心體驗——「打開工具就知道該做什麼」（A.1）和「做完自動回流」（A.2）——都需要 handoff/ready + capture 增強，這些在 Phase 1B。

**決策**：合併為單一 Phase 1（3-4 週），內部保留 Week 1-2（基礎層）→ Week 3-4（核心橋）的實作順序，因為基礎層是核心橋的數據依賴。

**效果**：Phase 1 覆蓋 5/8 場景（A.1, A.2, A.3, A.5, A.6），Phase 2 覆蓋剩餘 3/8（A.4, A.7, A.8，全部是 consult_coach）。

---

## Appendix A: 用戶體驗場景（User-Facing Conversations）

以下場景展示用戶在不同工具中的**實際對話體驗**——橋在背後無感運作。

### A.1 在 Claude Code 開發時自動獲得任務脈絡

用戶打開 Claude Code 就知道該做什麼，不用去 Zentropy App 查。

```
用戶：「今天要做什麼？」

Claude Code（自動讀取 zentropy://handoff/ready）：
「根據 Zentropy，你今天最高優先的是：

 1. [P1] 重構 auth 模組 — 到期明天
    原因：P95 延遲 > 2s，同步呼叫是瓶頸
    相關決策：ADR-005 採用 middleware pattern
    Coach 提醒：你在 refactor 類低估 1.8 倍，建議預留 7h

 2. [P2] Review PR #45 — 今天到期
    原因：阻擋 M2 開發，已等 3 天

 要從哪個開始？」
```

### A.2 Claude Code 幫你拆任務，自動回流到 Zentropy

不用手動把子任務抄回去，Claude Code 直接幫你存。

```
用戶：「我要開始做 auth 重構，先幫我看 codebase 拆任務」

Claude Code（讀取 codebase + zentropy://handoff/ready 的 context）：
「看完 auth 相關程式碼後，我建議以下拆解：
 1. auth.ts: 把 verifyToken middleware 改為 async (60min)
 2. routes/user.ts, routes/admin.ts, routes/api.ts: 更新呼叫方式 (90min)
 3. tests/auth.test.ts: 修改 mock (45min)
 4. 跑 benchmark 確認效能改善 (30min)
 5. 更新 API 文件 (15min)

 要我把這個拆解存回 Zentropy 嗎？」

用戶：「好」

→ Claude Code 呼叫 capture(mode=execution_plan, parent_id="act_001", ...)
→ 下次打開 Zentropy App，act_001 下已經有 5 個 sub-items
```

### A.3 在 Claude Desktop 隨手記，不用管分類

聊到一半想到什麼，丟進去就好。

```
用戶（在 Claude Desktop 聊天）：
「剛才跟客戶開會，他們希望 API 回傳格式從 snake_case 改成 camelCase，
 另外下週要交 Q1 報告，提醒我」

Claude Desktop：
「我幫你記到 Zentropy：
 ✓ API 格式變更需求 → 已歸到 Work/Client-A/API Integration
 ✓ Q1 報告提醒 → 已歸到 Work/Finance，到期下週五

 需要我幫你更深入分析 camelCase 遷移的影響嗎？」
```

（背後呼叫了兩次 `capture(mode=thought, ...)`，Gatekeeper 自動分類到不同的 Area/Product）

### A.4 諮詢 Coach 校正估時

不確定該花多少時間時，問 Coach。

```
用戶：「設計新的 notification 系統需要多久？我覺得 3 天吧」

→ consult_coach(intent=estimate, content="設計 notification 系統",
    user_estimate_minutes=1440, focus="design")

Coach 回應：
「你估了 3 天，但讓我查一下歷史：
 - 過去 8 次設計任務，你平均低估 2.1 倍
 - 類似複雜度的系統設計，中位數是 5 天
 - 建議：預留 6 天，在第 3 天安排一次 checkpoint

 你的設計類偏差一直偏高，要不要先花 1 天做 spike 確認範圍？」
```

### A.5 完成任務後自動追蹤偏差

做完就告訴它，Coach 自動學習你的模式。

```
用戶（在 Claude Code 完成工作後）：「auth 重構完了，大概花了 5 小時」

→ report_done(action_id="act_001", actual_duration_minutes=300)

「已記錄完成。Coach 的回饋：
 - 預估 4h → 實際 5h（偏差 1.25x）
 - 比你的 refactor 歷史平均（1.8x）好很多！
 - 你的 refactor 偏差因子從 1.8 更新為 1.73

 接下來 handoff/ready 裡的下一個是 Review PR #45，要看嗎？」
```

### A.6 在 Cursor 寫程式時自動參考知識庫

AI 寫程式時自動知道你的架構決策和規格。

```
用戶（在 Cursor 中）：「幫我寫 Librarian 的新規則引擎」

Cursor AI（自動讀取 zentropy://knowledge/Work/Zentropy/Architecture/Librarian_Engine
  + zentropy://handoff/ready 中相關的 context_package）：

「根據 Zentropy 知識庫中的 Librarian 架構文件，
 以及 ADR-008 的決策（採用 rule chain pattern），
 我來寫 rule engine...」
```

（AI 不會瞎猜架構，因為它已經有完整的 context）

### A.7 Coach 幫你挑戰一個計畫

在做重大決定前，讓 Coach 當反方。

```
用戶：「我打算下個月同時上線 notification 系統和 billing 重構」

→ consult_coach(intent=challenge, content="下月同時上線...", focus="feasibility")

Coach：
「讓我挑戰一下：

 1. 時間衝突：兩個都是大型任務，你下月還有 Client-A 的 deadline
 2. 風險疊加：如果 billing 重構出 bug，notification 系統的上線也會受影響
 3. 歷史：上次同時推兩個大功能（2025-09），有一個延遲了 3 週

 值得思考：可以先上 notification（風險較低），billing 放下下月嗎？」
```

### A.8 想法深化——從模糊到具體

```
用戶：「我在想要不要做一個 Zentropy 的 mobile app」

→ consult_coach(intent=refine, content="Zentropy mobile app")

Coach：
「你的核心意圖是讓用戶隨時都能 capture，對嗎？

 假設分析：
 - 假設 1：用戶需要在手機上 capture（合理——碎片時間最多）
 - 假設 2：用戶需要在手機上做 planning（存疑——手機不適合深度思考）

 盲點：
 - 你考慮過 LINE/Telegram bot 嗎？用戶不需要裝新 app
 - 上次（2025-12）考慮 mobile app 時，因 React Native 學習曲線放棄

 建議路徑：
 1. [P1] 先做 Telegram bot 驗證 capture 需求（1 週）
 2. [P2] 觀察 2 週用戶使用頻率
 3. [P3] 如果日均 capture > 5 次，再投入 mobile app」
```

### 場景共同特徵

**用戶不需要在 Zentropy App 和工作工具之間來回切換。** Zentropy 的 intelligence 透過 MCP 自動出現在用戶所在的地方——這就是「橋」的體驗。
