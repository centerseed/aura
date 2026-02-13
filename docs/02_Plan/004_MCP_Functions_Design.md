# MCP Functions Design — Execution Layer 完整設計

**版本**: v1.0
**日期**: 2026-02-13
**前置文件**:
- `docs/01_Specification/001_Product_Definition.md` — 產品定義 (L1-L5 + Execute)
- `docs/01_Specification/010_MCP_Server_Spec.md` — MCP 安全架構 (v2.0)
- `docs/research/Zentropy_vs_OpenClaw_Strategy_Report.md` — 競爭策略

---

## 1. 設計動機

### 1.1 現況

目前 MCP Server 提供 3 Tools + 3 Resources + 2 Prompts，僅覆蓋 L1-L2（Capture + Organize）：

| 現有 | 覆蓋層 | 功能 |
|:-----|:-------|:-----|
| `capture_thought` | L1 | 輸入碎片到 Inbox |
| `append_to_knowledge` | L2 | 寫入知識庫 |
| `query_memory` | L1-L2 | 語意搜尋 |

**缺口**：L3 Refine、L4 Plan、L5 Review、Execute 邊界 — 全部為零。

### 1.2 Execute 邊界的定位

產品定義明確指出 Execute 不是獨立層，而是 **Zentropy 的輸出邊界**：

```
簡單動作 → Zentropy 透過 MCP 直接代勞（建 calendar event、發通知）
複雜執行 → 用戶在外部工具執行，Zentropy 提供 context
結果回收 → 執行結果回流 Review 層，形成閉環
```

因此 MCP 必須同時扮演：
1. **Context Provider** — 向外部 AI 提供完整脈絡（specs、計畫、記憶）
2. **Action Handler** — 接受外部 AI 觸發的動作（capture、plan、review）
3. **Execution Proxy** — 代理簡單動作到外部服務（日曆、通知）
4. **Result Collector** — 收集執行結果回流到 Review

### 1.3 競品研究洞察

研究了 Heptabase、Todoist、Linear、Notion、Obsidian、Things 3、Roam Research 的 MCP 實作後，關鍵洞察：

| 觀察 | 對 Zentropy 的啟發 |
|:-----|:-----------------|
| Heptabase 僅 9 tools，寫入限制在 inbox + journal append | 寫入端保守是對的——限制寫入面，降低安全風險 |
| Todoist community 版 19 tools 覆蓋完整 task lifecycle | 任務生命週期管理（create→update→complete→archive）是必備 |
| Linear 40+ tools 包含 initiatives→projects→cycles→issues | 階層式目標拆解的 CRUD 很有價值，但 Zentropy 的階層是 Area→Product→Topic |
| Notion 用 data sources 作為第一級抽象 | Zentropy 可以用 Entity（Area/Product/Topic）作為第一級抽象 |
| Roam 有 `remember`/`recall` 記憶原語 | **規劃記憶（Episodic Memory）應是 MCP 的原生能力** |
| Obsidian semantic MCP 把 20+ tools 整合成 5 個語意操作 | 工具數量不是越多越好，語意明確比 CRUD 泛化更重要 |
| 所有競品都沒有：規劃校正、偏差追蹤、想法深化 | **這是 Zentropy 的差異化空間** |

---

## 2. 設計原則

1. **Agent-Mediated, Not Direct CRUD**
   - 不做 Notion/Linear 式的泛化 CRUD（`create_page`, `update_block`）
   - 每個 tool 背後都有 Agent 邏輯（Gatekeeper 分類、Librarian 歸檔、Coach 分析）
   - 用戶「丟進來」，Agent「處理好」

2. **語意操作 > 原子操作**
   - 不暴露 `updateTaskStatus`，而是 `complete_action`（Coach 自動歸檔 + 計算偏差）
   - 不暴露 `createTask`，而是 `plan_action`（Coach 自動估時 + 排程）

3. **Thin Interface, Thick Backend**
   - MCP Server 只做：認證、驗證、路由、淨化
   - 複雜邏輯在 Backend API 的 Use Case 層

4. **漸進式暴露**
   - Phase 1 先做核心（覆蓋完整 L1-L5 最小集）
   - Phase 2 加強差異化（Episodic Memory、偏差校正）
   - Phase 3 擴展執行（日曆整合、通知）

5. **單一 Scope 原則**
   - 每個 tool 只需一個 scope（降低授權複雜度）
   - 但允許 tool 內部讀取其他資料（透過 Backend API，由 RLS 控制）

---

## 3. OAuth Scopes 擴展

### 現有 Scopes（保留）

| Scope | 說明 |
|:------|:-----|
| `read:tasks` | 讀取任務與行動項目 |
| `read:knowledge` | 讀取知識庫 |
| `read:profile` | 讀取用戶偏好 |
| `write:inbox` | 寫入 Inbox |
| `write:knowledge` | 寫入知識庫 |
| `trigger:librarian` | 觸發 Librarian |

### 新增 Scopes

| Scope | 說明 | 對應新工具 |
|:------|:-----|:---------|
| `write:actions` | 建立/更新行動項目 | `plan_action`, `complete_action`, `update_action` |
| `read:plan` | 讀取計畫與排程 | `get_daily_plan`, 日計畫 Resource |
| `read:review` | 讀取回顧報告 | `get_briefing`, `get_weekly_review` |
| `trigger:coach` | 觸發 Coach Agent | `refine_idea`, `challenge_plan`, `detect_conflicts` |
| `write:execution` | 代理執行外部動作 | `proxy_calendar_event` |

### Scope 組合建議

| 模式 | Scopes | 使用場景 |
|:-----|:-------|:---------|
| **唯讀** | `read:tasks read:knowledge read:plan` | Cursor 讀取 context coding |
| **捕捉** | 唯讀 + `write:inbox` | Claude Desktop 隨手記 |
| **規劃** | 唯讀 + `write:inbox write:actions trigger:coach` | Claude Desktop 做規劃 |
| **完整** | 全部 | 完全信任的 client |

---

## 4. MCP Tools 完整設計

### 4.0 設計總覽

```
L1 Capture          L2 Organize         L3 Refine           L4 Plan             L5 Review           Execute
─────────────       ─────────────       ─────────────       ─────────────       ─────────────       ─────────────
capture_thought ✅  append_to_          refine_idea         plan_action         get_briefing        proxy_calendar_
                    knowledge ✅                                                                    event
capture_decision    query_memory ✅     challenge_plan      complete_action     get_weekly_review
                    list_items                              get_daily_plan      detect_conflicts
capture_execution                                          estimate_with_
_result                                                    _history

✅ = 已實作
```

共計：**15 Tools**（現有 3 + 新增 12）

---

### 4.1 L1 Capture — 零摩擦輸入

#### `capture_thought` ✅ 已實作，保留不變

#### `capture_decision`

記錄一個決策及其上下文。與 `capture_thought` 的區別：決策有明確的結論和理由，會被 Librarian 標記為 Decision Record 而非普通 inbox item。

```yaml
name: capture_decision
scope: write:inbox
arguments:
  decision:
    type: string
    required: true
    max: 2000
    description: "決策內容 — 我們決定了什麼"
  rationale:
    type: string
    required: true
    max: 5000
    description: "決策理由 — 為什麼這樣決定"
  context_hint:
    type: string
    required: false
    max: 200
    description: "語意提示（Area/Product）"
  alternatives_considered:
    type: string
    required: false
    max: 3000
    description: "考慮過但放棄的方案"
backend_endpoint: POST /api/brain-dump (type=decision)
agent: Gatekeeper → Librarian
behavior:
  1. Gatekeeper 解析決策結構
  2. Librarian 歸檔為 Decision Record
  3. Librarian 自動關聯相關知識（Cross-Reference）
response: |
  {
    "id": "dec_xxx",
    "status": "filed",
    "filed_to": { "area": "Work", "product": "Zentropy", "topic": "Architecture" },
    "related_items": ["task_123", "dec_045"]
  }
```

**為什麼需要這個（而不是用 capture_thought）**：
- 決策是知識庫中最高價值的資訊類型
- 在 Cursor/Claude Code 中做出架構決定時，一鍵記錄
- Librarian 對決策有特殊處理邏輯：自動建立 ADR 格式、關聯相關任務

#### `capture_execution_result`

將執行結果回流到 Zentropy，**形成閉環**。這是 Execute 邊界的「回收站」。

```yaml
name: capture_execution_result
scope: write:inbox
arguments:
  action_id:
    type: string
    required: true
    description: "對應的行動項目 ID"
  outcome:
    type: enum
    values: [completed, partial, blocked, cancelled]
    required: true
    description: "執行結果狀態"
  actual_duration_minutes:
    type: number
    required: false
    description: "實際花費時間（分鐘）— 用於偏差校準"
  notes:
    type: string
    required: false
    max: 5000
    description: "執行筆記 — 遇到什麼、學到什麼"
backend_endpoint: POST /api/actions/{action_id}/result
agent: Coach
behavior:
  1. 驗證 action_id 存在且屬於該用戶
  2. 記錄 outcome + actual_duration
  3. Coach 計算 estimated vs actual 偏差
  4. 更新 Episodic Memory（個人偏差因子）
  5. 如果 outcome=blocked，Coach 標記需要關注
response: |
  {
    "action_id": "act_xxx",
    "outcome": "completed",
    "deviation": {
      "estimated_minutes": 120,
      "actual_minutes": 180,
      "ratio": 1.5,
      "running_average_for_type": 1.3
    }
  }
```

**為什麼需要這個**：
- 閉環是 L5 Review 的基礎
- 沒有實際結果數據，Episodic Memory 就是空的
- 這是 Reference Class Forecasting 的數據來源
- 競品完全沒有這個功能

---

### 4.2 L2 Organize — 智慧歸檔

#### `append_to_knowledge` ✅ 已實作，保留不變

#### `query_memory` ✅ 已實作，保留不變

#### `list_items`

列出用戶的項目（任務、決策、知識），支援 Entity 階層和狀態篩選。

```yaml
name: list_items
scope: read:tasks
arguments:
  area:
    type: string
    required: false
    description: "篩選 Area（如 'Work', 'Personal'）"
  product:
    type: string
    required: false
    description: "篩選 Product（如 'Zentropy'）"
  topic:
    type: string
    required: false
    description: "篩選 Topic（如 'Architecture'）"
  status:
    type: enum
    values: [active, maintain, reference, inbox, all]
    required: false
    default: active
    description: "篩選狀態軸"
  item_type:
    type: enum
    values: [action, decision, note, all]
    required: false
    default: all
    description: "篩選項目類型"
  limit:
    type: number
    required: false
    default: 20
    max: 50
    description: "回傳筆數上限"
  cursor:
    type: string
    required: false
    description: "分頁游標"
backend_endpoint: GET /api/items
agent: 無（直接查詢，RLS 控制權限）
response: |
  {
    "items": [
      {
        "id": "act_xxx",
        "type": "action",
        "title": "完成 MCP Functions 設計",
        "status": "active",
        "area": "Work",
        "product": "Zentropy",
        "topic": "Architecture",
        "due_date": "2026-02-14",
        "estimated_minutes": 120
      }
    ],
    "next_cursor": "abc123",
    "total_count": 42
  }
```

**為什麼需要這個**：
- 外部 AI 需要知道「用戶現在手上有什麼」才能提供有意義的建議
- Cursor 中寫程式時，AI 需要讀取相關 active tasks 來理解優先級
- 這是所有 task management MCP 的標配（Todoist, Linear, Things 全有）

---

### 4.3 L3 Refine — 思考夥伴

這是 Zentropy 最大的差異化。目前市場上**沒有任何 MCP** 提供「想法深化」工具。

#### `refine_idea`

提交一個模糊想法，Coach Agent 會分析、補盲點、提出結構化的行動路徑。

```yaml
name: refine_idea
scope: trigger:coach
arguments:
  idea:
    type: string
    required: true
    max: 5000
    description: "模糊的想法或概念"
  area:
    type: string
    required: false
    description: "相關的 Area（幫助 Coach 載入正確 context）"
  depth:
    type: enum
    values: [quick, thorough]
    required: false
    default: quick
    description: |
      quick: 1-2 段落的快速回饋（< 10 秒）
      thorough: 完整分析含盲點、風險、行動路徑（可能需 30+ 秒）
backend_endpoint: POST /api/coach/refine
agent: Coach
behavior:
  1. Coach 載入相關 Area/Product 的 Rolling Saga 作為 context
  2. Coach 載入 Episodic Memory（用戶過去類似想法的結果）
  3. Coach 分析：
     - 核心假設是什麼？
     - 有什麼盲點或遺漏？
     - 類似的歷史案例（如果有）
     - 具體化的行動路徑
  4. 回傳結構化分析
response: |
  {
    "refined": {
      "core_thesis": "你想做的本質上是...",
      "assumptions": ["假設1: ...", "假設2: ..."],
      "blind_spots": ["你可能沒考慮到: ..."],
      "similar_history": [
        {
          "item_id": "dec_045",
          "title": "上次類似的決定",
          "outcome": "花了比預期多 2 倍時間"
        }
      ],
      "suggested_actions": [
        { "action": "先做 X 驗證假設1", "priority": "high" },
        { "action": "跟 Y 確認 Z", "priority": "medium" }
      ]
    },
    "auto_captured": true,
    "captured_as": "task_xxx"
  }
```

**為什麼需要這個**：
- 產品定義 L3 的核心：「想法太模糊？AI 幫你 brainstorm、補盲點、具體化」
- OpenClaw 只會執行命令，不會質疑——這是 Zentropy Coach 的差異
- 在 Claude Desktop 中自然語言聊到一個想法 → 一鍵 refine

#### `challenge_plan`

提交一個計畫或假設，Coach Agent 會刻意「扮演反方」挑戰它。

```yaml
name: challenge_plan
scope: trigger:coach
arguments:
  plan:
    type: string
    required: true
    max: 5000
    description: "要被挑戰的計畫或假設"
  focus:
    type: enum
    values: [feasibility, timeline, risk, scope, all]
    required: false
    default: all
    description: "聚焦挑戰的面向"
backend_endpoint: POST /api/coach/challenge
agent: Coach
behavior:
  1. Coach 載入相關 context
  2. Coach 載入歷史偏差數據
  3. Coach 系統性挑戰：
     - feasibility: 技術可行性、資源可得性
     - timeline: 估時準確度（Reference Class Forecasting）
     - risk: 外部依賴、不可控因素
     - scope: 範圍是否合理、是否 over-scoped
  4. 呈現「值得思考的問題」而非直接否定
response: |
  {
    "challenges": [
      {
        "aspect": "timeline",
        "challenge": "你估計 2 週完成，但歷史上類似任務平均花 3.5 週",
        "data": {
          "your_estimate_days": 14,
          "historical_median_days": 24,
          "your_bias_ratio": 1.7
        },
        "question": "deadline 是硬性的嗎？可以縮小範圍嗎？"
      },
      {
        "aspect": "risk",
        "challenge": "有 2 個外部依賴尚未確認",
        "question": "如果 X 延遲，備案是什麼？"
      }
    ],
    "overall_confidence": "medium",
    "suggestion": "建議在第 1 週末安排一次 checkpoint 重新評估"
  }
```

**為什麼需要這個**：
- 策略報告明確指出：目前所有產品只做 Execution，沒有 Thought Partner
- 「挑戰假設」是 Coach 的核心能力，也是最難被複製的
- 結合 Episodic Memory 的歷史偏差數據，挑戰才有數據支撐而非泛泛而談

---

### 4.4 L4 Plan — 智慧規劃

#### `plan_action`

建立一個行動項目。與 Todoist 的 `createTask` 不同：Coach 會自動提供估時校正。

```yaml
name: plan_action
scope: write:actions
arguments:
  title:
    type: string
    required: true
    max: 200
    description: "行動標題"
  description:
    type: string
    required: false
    max: 5000
    description: "行動描述"
  product:
    type: string
    required: false
    description: "所屬 Product"
  topic:
    type: string
    required: false
    description: "所屬 Topic"
  estimated_minutes:
    type: number
    required: false
    description: "用戶估計所需時間（分鐘）"
  due_date:
    type: string
    format: date
    required: false
    description: "到期日 (YYYY-MM-DD)"
  priority:
    type: enum
    values: [urgent, high, medium, low]
    required: false
    default: medium
backend_endpoint: POST /api/actions
agent: Gatekeeper (分類) → Coach (估時校正)
behavior:
  1. Gatekeeper 自動歸類到 Area/Product/Topic
  2. 如果用戶提供 estimated_minutes：
     - Coach 查詢 Episodic Memory 找類似任務
     - 計算 Reference Class Forecast
     - 回傳校正後的估時建議
  3. 建立 Action Item (status: active)
response: |
  {
    "id": "act_xxx",
    "title": "完成 MCP Functions 設計",
    "status": "active",
    "filed_to": { "area": "Work", "product": "Zentropy", "topic": "Architecture" },
    "estimation": {
      "user_estimate_minutes": 120,
      "coach_estimate_minutes": 180,
      "bias_factor": 1.5,
      "reasoning": "歷史上類似的設計任務，你平均低估 1.5 倍",
      "similar_tasks_count": 8
    }
  }
```

#### `complete_action`

完成一個行動項目。Coach 自動計算偏差並歸檔。

```yaml
name: complete_action
scope: write:actions
arguments:
  action_id:
    type: string
    required: true
    description: "要完成的行動 ID"
  actual_duration_minutes:
    type: number
    required: false
    description: "實際花費時間（分鐘）"
  notes:
    type: string
    required: false
    max: 2000
    description: "完成筆記"
backend_endpoint: POST /api/actions/{action_id}/complete
agent: Coach
behavior:
  1. 標記 action 為 completed
  2. 計算 estimated vs actual 偏差
  3. 更新 Episodic Memory
  4. 如果有相關的 sub-items，通知用戶
  5. Librarian 歸檔到 History
response: |
  {
    "action_id": "act_xxx",
    "status": "completed",
    "completed_at": "2026-02-13T15:30:00Z",
    "deviation": {
      "estimated_minutes": 120,
      "actual_minutes": 180,
      "ratio": 1.5
    }
  }
```

#### `update_action`

更新行動項目的屬性（描述、優先級、到期日等）。

```yaml
name: update_action
scope: write:actions
arguments:
  action_id:
    type: string
    required: true
  title:
    type: string
    required: false
    max: 200
  description:
    type: string
    required: false
    max: 5000
  priority:
    type: enum
    values: [urgent, high, medium, low]
    required: false
  due_date:
    type: string
    format: date
    required: false
  status:
    type: enum
    values: [active, maintain, blocked]
    required: false
backend_endpoint: PATCH /api/actions/{action_id}
agent: 無（直接更新，RLS 控制權限）
```

#### `get_daily_plan`

取得 AI 生成的今日行動計畫。

```yaml
name: get_daily_plan
scope: read:plan
arguments:
  date:
    type: string
    format: date
    required: false
    default: today
    description: "查詢日期 (YYYY-MM-DD)"
  area:
    type: string
    required: false
    description: "只看特定 Area 的計畫"
backend_endpoint: GET /api/coach/daily-plan
agent: Coach
behavior:
  1. 掃描所有 active actions（依 due_date + priority 排序）
  2. 考慮日曆中已有的行程（如果有日曆整合）
  3. 考慮用戶的精力模式（如果有足夠歷史數據）
  4. 生成優先排序的每日行動清單
  5. 標記可能的時間衝突
response: |
  {
    "date": "2026-02-13",
    "plan": {
      "top_priorities": [
        {
          "action_id": "act_001",
          "title": "完成 MCP Functions 設計",
          "estimated_minutes": 180,
          "reason": "明天到期，且阻擋 M2 開發"
        }
      ],
      "also_today": [
        {
          "action_id": "act_002",
          "title": "Review PR #45",
          "estimated_minutes": 30
        }
      ],
      "total_estimated_minutes": 210,
      "conflicts": [],
      "coach_note": "今天行程較輕，適合深度工作。建議上午處理設計任務。"
    }
  }
```

#### `estimate_with_history`

對一個任務描述進行 Reference Class Forecasting。不建立任何項目，純粹提供估時建議。

```yaml
name: estimate_with_history
scope: trigger:coach
arguments:
  task_description:
    type: string
    required: true
    max: 2000
    description: "任務描述"
  user_estimate_minutes:
    type: number
    required: false
    description: "用戶的初始估計"
  task_type:
    type: string
    required: false
    description: "任務類型提示（如 'design', 'development', 'meeting'）"
backend_endpoint: POST /api/coach/estimate
agent: Coach
behavior:
  1. 從 Episodic Memory 檢索類似的歷史任務
  2. 計算分佈估計（中位數、P75、P90）
  3. 套用個人偏差因子
  4. 如果用戶提供估計，計算偏差預測
response: |
  {
    "task_description": "設計新的 API 介面",
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
      "historical_bias_ratio": 2.1,
      "sample_size": 8
    },
    "recommendation": {
      "suggested_minutes": 180,
      "confidence": "medium",
      "reasoning": "基於 12 個類似任務，你的設計類偏差為 2.1 倍。建議保守預留 180 分鐘。"
    }
  }
```

**為什麼需要這個**：
- 策略報告的核心武器之一：Reference Class Forecasting
- 目前市場上**零產品**實作此功能
- 有病毒式傳播潛力：「看看你估時有多不準！」

---

### 4.5 L5 Review — 主動教練

#### `get_briefing`

取得晨報或晚報。

```yaml
name: get_briefing
scope: read:review
arguments:
  type:
    type: enum
    values: [morning, evening]
    required: true
    description: "晨報或晚報"
  date:
    type: string
    format: date
    required: false
    default: today
backend_endpoint: GET /api/coach/briefing
agent: Coach
behavior:
  morning:
    1. 掃描今日到期 + overdue actions
    2. 檢查日曆衝突
    3. 生成 Top 3 優先事項
    4. 附帶 Coach 鼓勵/建議
  evening:
    1. 統計今日完成項目
    2. 識別延遲/未完成項目
    3. 為明天提出計畫建議
    4. 心理閉環：「今天已經做到 X，明天可以處理 Y」
response: |
  {
    "type": "morning",
    "date": "2026-02-13",
    "briefing": {
      "open_loops": 5,
      "due_today": 2,
      "overdue": 1,
      "top_priorities": ["act_001", "act_002"],
      "calendar_conflicts": [],
      "coach_message": "今天有 2 項到期。MCP 設計文件是最高優先，建議早上先處理。"
    }
  }
```

#### `get_weekly_review`

取得 AI 自動生成的每週回顧（GTD Weekly Review 自動化）。

```yaml
name: get_weekly_review
scope: read:review
arguments:
  week:
    type: string
    required: false
    default: current
    description: "週次 (YYYY-Wxx) 或 'current' / 'previous'"
backend_endpoint: GET /api/coach/weekly-review
agent: Coach
behavior:
  1. 掃描本週所有活動：
     - 完成的 actions
     - 新增的 items
     - 歸檔的 decisions
  2. 識別問題：
     - 停滯任務（> 2 週沒動的 active items）
     - 孤兒項目（沒有下一步行動的 Product）
     - 估時偏差趨勢
  3. 生成 5 分鐘可消化的摘要
  4. 提出下週建議
response: |
  {
    "week": "2026-W07",
    "summary": {
      "completed": 8,
      "new_items": 5,
      "stalled": 2,
      "orphans": 1,
      "estimation_accuracy_this_week": 0.73
    },
    "stalled_items": [
      {
        "id": "act_032",
        "title": "聯繫法律顧問",
        "stalled_since": "2026-01-28",
        "suggestion": "歸檔或重新排期？"
      }
    ],
    "estimation_trend": {
      "this_week": 1.4,
      "last_4_weeks": [1.2, 1.5, 1.3, 1.4],
      "insight": "設計任務持續低估，其他類型趨於準確"
    },
    "coach_note": "本週完成 8 項，比上週多 2 項。估時準確度穩定在 73%，設計類仍需改善。建議下週先處理停滯的法律事項。"
  }
```

**為什麼需要這個**：
- GTD 的 #1 放棄觸發點是 Weekly Review（60-120 分鐘太痛苦）
- Coach 將其壓縮到 5 分鐘確認
- 這是 Zentropy 留存率的關鍵

#### `detect_conflicts`

主動掃描衝突、停滯、資源撞車。

```yaml
name: detect_conflicts
scope: read:review
arguments:
  scope:
    type: enum
    values: [today, this_week, all_active]
    required: false
    default: this_week
backend_endpoint: GET /api/coach/conflicts
agent: Coach
behavior:
  1. 掃描時間衝突（同一天 > 8 小時任務量）
  2. 掃描到期衝突（多項同日到期）
  3. 掃描停滯項目（active 但 > 14 天未更新）
  4. 掃描依賴衝突（被 blocked 的 action 阻擋了其他 action）
response: |
  {
    "conflicts": [
      {
        "type": "overload",
        "date": "2026-02-15",
        "details": "當天排了 10 小時任務，超出合理容量",
        "suggestion": "將 'Review PR #45' 移至 2/16"
      },
      {
        "type": "stalled",
        "item_id": "act_032",
        "details": "已停滯 16 天",
        "suggestion": "歸檔、委派或重新設定到期日"
      }
    ],
    "health_score": 72
  }
```

---

### 4.6 Execute — 執行邊界

#### `proxy_calendar_event`

代理建立日曆事件。這是 Execute 邊界的典型案例：「簡單動作，Zentropy 代勞」。

```yaml
name: proxy_calendar_event
scope: write:execution
arguments:
  title:
    type: string
    required: true
    max: 200
  start_time:
    type: string
    format: datetime
    required: true
    description: "ISO 8601 格式"
  end_time:
    type: string
    format: datetime
    required: true
  description:
    type: string
    required: false
    max: 2000
  action_id:
    type: string
    required: false
    description: "關聯的 Zentropy action（建立雙向連結）"
backend_endpoint: POST /api/execute/calendar
agent: Coach (驗證衝突) → Calendar Integration
behavior:
  1. Coach 檢查是否與現有行程衝突
  2. 如果有 action_id，建立雙向關聯
  3. 透過 Google Calendar API 建立事件
  4. 回傳確認
prerequisite: 用戶已連接 Google Calendar
response: |
  {
    "calendar_event_id": "gcal_xxx",
    "conflicts_detected": false,
    "linked_action_id": "act_001"
  }
```

---

## 5. MCP Resources 擴展

### 現有 Resources（保留）

| URI Pattern | Scope | 說明 |
|:------------|:------|:-----|
| `zentropy://knowledge/{area}/{product}/{topic}` | `read:knowledge` | 知識庫文件 |
| `zentropy://saga/{product_id}` | `read:knowledge` | Rolling Saga |
| `zentropy://profile/bias-vector` | `read:profile` | 用戶偏好 |

### 新增 Resources

#### `zentropy://plan/today`

今日計畫的唯讀 Resource。AI 在其他工具中可以直接讀取。

```yaml
uri: zentropy://plan/today
scope: read:plan
mime_type: application/json
content: |
  與 get_daily_plan tool 相同的數據結構。
  差異：Resource 是被動讀取（AI 自動載入），Tool 是主動觸發。
use_case: |
  Cursor 用戶在寫程式時，AI 自動讀取今日計畫，
  知道用戶正在做什麼、接下來該做什麼。
```

#### `zentropy://plan/week`

本週概覽。

```yaml
uri: zentropy://plan/week
scope: read:plan
mime_type: application/json
content: |
  {
    "week": "2026-W07",
    "days": {
      "2026-02-09": { "actions": [...], "total_minutes": 240 },
      ...
    },
    "overdue": [...],
    "upcoming_deadlines": [...]
  }
```

#### `zentropy://inbox/pending`

當前 Inbox 待處理項目。

```yaml
uri: zentropy://inbox/pending
scope: read:tasks
mime_type: application/json
content: |
  { "items": [...], "count": 5 }
use_case: |
  讓 AI 知道有多少未處理的碎片，
  可以在對話中適時提醒用戶。
```

#### `zentropy://memory/estimation-bias`

個人估時偏差報告。

```yaml
uri: zentropy://memory/estimation-bias
scope: read:review
mime_type: application/json
content: |
  {
    "overall_bias": 1.4,
    "by_type": {
      "design": { "bias": 2.1, "sample_size": 8 },
      "development": { "bias": 1.0, "sample_size": 15 },
      "meeting": { "bias": 1.3, "sample_size": 12 }
    },
    "trend": "improving"
  }
use_case: |
  AI 在幫用戶估時時，自動讀取偏差數據，
  主動進行校正而不需用戶觸發 estimate_with_history。
```

#### `zentropy://areas`

用戶的 Area/Product/Topic 階層結構。

```yaml
uri: zentropy://areas
scope: read:tasks
mime_type: application/json
content: |
  {
    "areas": [
      {
        "name": "Work",
        "products": [
          {
            "name": "Zentropy",
            "topics": ["Architecture", "Frontend", "DevOps"],
            "active_actions": 12,
            "status": "active"
          }
        ]
      }
    ]
  }
use_case: |
  外部 AI 了解用戶的角色結構，
  在 capture 時自動推斷應歸到哪個 Area/Product。
```

---

## 6. MCP Prompts 擴展

### 現有 Prompts（保留）

| Name | 說明 |
|:-----|:-----|
| `summarize-for-zentropy` | 將對話整理為 Rolling Summary 格式 |
| `generate-spec-structure` | 生成 Spec 文件結構 |

### 新增 Prompts

#### `plan-next-actions`

```yaml
name: plan-next-actions
description: "根據當前脈絡，生成下一步行動建議"
arguments:
  context:
    type: string
    description: "當前對話或工作脈絡"
  product:
    type: string
    optional: true
    description: "相關 Product"
template: |
  基於以下脈絡，識別具體的下一步行動：

  脈絡：{context}
  產品：{product}

  要求：
  1. 每個行動必須可在 2 小時內完成
  2. 標明優先級 (urgent/high/medium/low)
  3. 如果行動之間有依賴關係，標明順序
  4. 估計每個行動的時間

  輸出格式：
  - [ ] [P1] 行動描述 (估時 Xm)
  - [ ] [P2] 行動描述 (估時 Xm)
```

#### `write-decision-record`

```yaml
name: write-decision-record
description: "將討論結果結構化為決策紀錄 (ADR 格式)"
arguments:
  discussion:
    type: string
    description: "決策討論的內容"
template: |
  將以下討論整理為 Zentropy 標準的決策紀錄 (ADR)：

  討論內容：{discussion}

  輸出格式：
  # ADR: [標題]
  ## 背景 (Context)
  ## 決策 (Decision)
  ## 理由 (Rationale)
  ## 替代方案 (Alternatives Considered)
  ## 後果 (Consequences)
```

---

## 7. 實作分期

### Phase 1 — 核心閉環 (M1.5 ~ M2)

**目標**：覆蓋完整 L1-L5 最小集，形成 Capture → Plan → Execute → Review 閉環。

| Tool | 層 | 優先級 | 原因 |
|:-----|:--|:-------|:-----|
| `list_items` | L2 | P0 | 最基礎的讀取能力，所有後續功能依賴它 |
| `plan_action` | L4 | P0 | 行動項目是閉環的起點 |
| `complete_action` | L4 | P0 | 閉環的關鍵一步 |
| `get_briefing` | L5 | P0 | 用戶留存的核心（晨晚報） |
| `capture_execution_result` | Execute | P0 | 閉環的回收站，Episodic Memory 的數據來源 |
| `zentropy://plan/today` | Resource | P0 | AI 被動讀取今日計畫 |
| `zentropy://areas` | Resource | P0 | AI 了解用戶的角色結構 |

**新增 Scopes**: `write:actions`, `read:plan`, `read:review`
**Backend Endpoints 需要新建**: `/api/actions`, `/api/coach/daily-plan`, `/api/coach/briefing`

### Phase 2 — 差異化武器 (M2 ~ M3)

**目標**：實作 Zentropy 的三大差異化能力。

| Tool | 層 | 優先級 | 原因 |
|:-----|:--|:-------|:-----|
| `estimate_with_history` | L4 | P1 | Reference Class Forecasting — 病毒式傳播潛力 |
| `refine_idea` | L3 | P1 | Thought Partner — 市場空白 |
| `challenge_plan` | L3 | P1 | Thought Partner — 深化版 |
| `get_weekly_review` | L5 | P1 | GTD 自動化 — 留存率關鍵 |
| `capture_decision` | L1 | P1 | 高價值知識捕捉 |
| `update_action` | L4 | P1 | 任務管理基本操作 |
| `zentropy://memory/estimation-bias` | Resource | P1 | AI 被動讀取偏差數據 |
| `plan-next-actions` | Prompt | P1 | 行動規劃模板 |
| `write-decision-record` | Prompt | P1 | ADR 生成模板 |

**Backend Endpoints 需要新建**: `/api/coach/estimate`, `/api/coach/refine`, `/api/coach/challenge`, `/api/coach/weekly-review`

### Phase 3 — 執行擴展 (M3+)

| Tool | 層 | 優先級 | 原因 |
|:-----|:--|:-------|:-----|
| `detect_conflicts` | L5 | P2 | 衝突偵測 |
| `proxy_calendar_event` | Execute | P2 | 日曆整合（需 Google Calendar OAuth） |
| `zentropy://plan/week` | Resource | P2 | 週計畫 Resource |
| `zentropy://inbox/pending` | Resource | P2 | Inbox 狀態 Resource |

**新增 Scope**: `write:execution`
**外部整合**: Google Calendar API

---

## 8. 與競品的差異化總結

| 能力 | Todoist MCP | Linear MCP | Heptabase MCP | Notion MCP | **Zentropy MCP** |
|:-----|:-----------|:-----------|:-------------|:-----------|:----------------|
| Task CRUD | ✅ 完整 | ✅ 完整 | ❌ | ✅ 通用 | ✅ Agent-mediated |
| 知識搜尋 | ❌ | ❌ | ✅ 語意 | ✅ AI | ✅ 語意 + Entity 階層 |
| 想法深化 | ❌ | ❌ | ❌ | ❌ | ✅ `refine_idea` |
| 計畫挑戰 | ❌ | ❌ | ❌ | ❌ | ✅ `challenge_plan` |
| 估時校正 | ❌ | ❌ | ❌ | ❌ | ✅ `estimate_with_history` |
| 偏差記憶 | ❌ | ❌ | ❌ | ❌ | ✅ Episodic Memory |
| 每日計畫 | ❌ | ❌ | ❌ | ❌ | ✅ `get_daily_plan` |
| 每週回顧 | ❌ | ❌ | ❌ | ❌ | ✅ `get_weekly_review` |
| 結果回收 | ❌ | ❌ | ❌ | ❌ | ✅ `capture_execution_result` |
| 日曆代理 | ❌ | ❌ | ❌ | ❌ | ✅ `proxy_calendar_event` |

**核心差異**：其他 MCP 都是「資料讀寫介面」，Zentropy MCP 是「AI 營運教練的操作介面」。
