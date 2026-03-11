# Task 033: Agent Task Truthfulness Refactor

**Status**: In Progress
**Owner**: Codex / Antigravity
**Dependencies**:
- [`docs/01_Specification/015_Agent_Task_Truthfulness_Spec.md`](../01_Specification/015_Agent_Task_Truthfulness_Spec.md)
- [`docs/02_Plan/046_Agent_Task_Truthfulness_Implementation_Plan.md`](../02_Plan/046_Agent_Task_Truthfulness_Implementation_Plan.md)

## 1. 目標 (Objective)

重構 agent 的 query / completion 路徑，讓 LINE Bot 在「今天完成了什麼 / 今天要做什麼 / 標記完成」場景中，使用一致且可驗證的任務事實來源，避免輸出誤導性的空結果或不完整答案。

## 2. 範圍 (Scope)

涉及檔案與模組：

- `api/src/application/use-cases/agent/query-tasks-skill.ts`
- `api/src/application/use-cases/agent/complete-task-skill.ts`
- `api/src/application/use-cases/agent/zentropy-agent.ts`
- `api/src/app/api/line/webhook/route.ts`
- `api/src/infrastructure/services/unified-data-collector.ts`
- `api/src/infrastructure/repositories/prisma-task-repository.ts`
- `api/tests/unit/agent/*`
- `api/tests/integration/*agent*`

## 3. 任務清單 (Atomic Tasks)

## 3.1 目前進度補充 (2026-03-09)

已完成：

- completion write path 已收斂到 shared path，`completed_at` 成為完成查詢核心依據
- `query_tasks` 已改走 `AgentTaskQueryService`，不再由 skill 自行拼接查詢
- coverage 已擴到 Task / SubTask / Daily Plan Item
- 回覆已揭露總數、截斷與查詢範圍

剩餘缺口：

- `today_focus` 仍偏向 task list 摘要，尚未完全成為統一的 work-facts 視圖
- `complete_task_search` 仍以近似搜尋為主，缺少可驗證的候選/決策訊號
- tool output 仍以文字摘要為主，尚未提供完整結構化 facts-first protocol
- live 查詢延遲偏高，需要減少不必要的 sequential query 與重覆資料收集

## 3.2 失敗報告對應缺口 (2026-03-11)

根因補充：

- `FACTS` 洩漏不是單一 prompt 失誤，而是 orchestration 仍把 raw tool output / step text 當 final reply source
- 多輪指代錯位不是「LLM 不夠聰明」，而是 history entity extraction 把 preview、候選、摘要句混成同一個 mention pool
- `幫我把剛才記的那個標記完成` 失真來自 brain dump append 回覆缺少結構化 recorded items，導致整段摘要被當成 task title
- `run_planner` 失敗同時有兩層：provider tool args 對 `goal` 漏填，以及 planner 內層 structured output schema 過脆

新增待補任務：

- [ ] 將 tool final response 收斂為 canonical summary，禁止 raw `[FACTS]` 回傳給使用者
- [ ] 將 history entity extraction 改為最近一次結構化 list / recorded items
- [ ] 為 brain dump append/create 路徑補上結構化 facts
- [ ] 將 planner `goal` ownership 收回 application 層，並補 planner normalization tests

### T033-1: 盤點完成語義的所有寫入入口
**預計時間**: 20 分鐘  
**目的**: 確認所有會把 Task 標記完成的程式路徑，避免只修一半。

**執行內容**:
- 搜尋所有 `status = ARCHIVE`、`TaskStatus.ARCHIVE`、`completed_at` 寫入點
- 區分 LINE webhook、agent skill、use case、repository 路徑
- 列出哪些入口目前沒有寫 `completed_at`

**交付物**:
- [ ] 一份完成寫入入口清單
- [ ] 標記需要收斂的路徑

---

### T033-2: 收斂 Task completion semantics 到 shared path
**預計時間**: 1 小時  
**目的**: 確保任何完成操作都一致寫入 `completed_at`。

**執行內容**:
- 修改既有 task 完成 use case / repository path，確認：
  - `status = ARCHIVE`
  - `completed_at = now`
- reopen 時清除 `completed_at`
- 移除 agent skill / webhook 中的 direct update shortcut，改走 shared path

**交付物**:
- [ ] 完成路徑只保留單一語義來源
- [ ] LINE confirm flow 使用 shared completion path
- [ ] REST / internal path 行為一致

---

### T033-3: 補 completion semantics 單元與整合測試
**預計時間**: 45 分鐘

**測試情境**:
- [ ] Task 完成時會寫入 `completed_at`
- [ ] Task reopen 時會清除 `completed_at`
- [ ] LINE confirm 完成後，資料庫中 `completed_at` 不為空
- [ ] 既有路徑不再只寫 `status`

**交付物**:
- [ ] 對應 unit / integration tests

---

### T033-4: 建立 AgentTaskQueryService
**預計時間**: 1.5 小時  
**目的**: 讓 agent 查詢不再自己拼查詢邏輯。

**執行內容**:
- 新增 application service，例如 `agent-task-query-service.ts`
- 封裝：
  - `queryCompletedToday(userId, timezone)`
  - `queryTodayFocus(userId, timezone)`
- 初期優先接既有 shared data source，例如 unified collector / repository filters
- 回傳結構化 query result

**交付物**:
- [ ] `AgentTaskQueryService` 可被 skill 重用
- [ ] 不再由 skill 直接實作查詢規則

---

### T033-5: 定義 query result contract
**預計時間**: 45 分鐘

**執行內容**:
- 建立 TypeScript type / interface，至少包含：
  - `queryType`
  - `coverage`
  - `totalCount`
  - `displayCount`
  - `truncated`
  - `items`
  - `summary`
- 為 completed / today-focus 共用此 contract

**交付物**:
- [ ] 結構化 result type
- [ ] query service 與 formatter 共用同一份定義

---

### T033-6: 以 `completed_at` 重寫 completed-today 查詢
**預計時間**: 45 分鐘  
**目的**: 修正目前最關鍵的事實失真來源。

**執行內容**:
- 改掉 `query_completed_today_tasks` 目前使用 `updated_at` 的邏輯
- 查詢改為 `completed_at` 落在使用者當地今日範圍
- 若目前僅覆蓋 Task，結果中需帶出 coverage

**交付物**:
- [ ] completed-today 查詢只依賴 `completed_at`
- [ ] 結果具備 coverage / total / truncation 訊號

---

### T033-7: 對齊 today-focus 查詢到 shared fact source
**預計時間**: 1 小時

**執行內容**:
- 移除 `query-tasks-skill.ts` 內的簡化 Prisma 查詢
- 改為透過 `AgentTaskQueryService` 取得 today-focus 結果
- 排序至少包含：
  - 逾期
  - 今天到期
  - 明天 / 近期到期
  - 未排程活躍項目

**交付物**:
- [ ] today-focus 使用 shared query path
- [ ] 排序與主系統口徑一致

---

### T033-8: 實作 query result formatter
**預計時間**: 45 分鐘  
**目的**: 在 LINE 回覆保持簡潔，但不扭曲事實。

**執行內容**:
- 新增 formatter，將結構化 query result 轉成 user-facing summary
- 規則：
  - 顯示總數
  - 顯示前 N 筆
  - 若截斷，明示是摘要
  - 若 coverage 不完整，明示範圍

**交付物**:
- [ ] `completed_today` formatter
- [ ] `today_focus` formatter

---

### T033-9: 重構 query-tasks skill 成薄層
**預計時間**: 45 分鐘

**執行內容**:
- skill 只負責：
  - 判斷 intent
  - 呼叫對應 query service / tool
  - 使用 formatter 組 user-facing summary
- 移除 skill 內部的業務查詢細節

**交付物**:
- [ ] `query-tasks-skill.ts` 僅保留 routing + orchestration

---

### T033-10: 重構 complete-task skill 與 LINE confirm flow
**預計時間**: 1 小時

**執行內容**:
- `complete-task-skill.ts` 的完成執行改走 shared completion path
- `api/src/app/api/line/webhook/route.ts` 的確認流程同樣改走 shared use case
- 確保完成後可立即查詢到 `completed_at`

**交付物**:
- [ ] complete skill 不再直接手寫 `task.update({ status: ARCHIVE })`
- [ ] webhook confirm flow 不再繞過 domain semantics

---

### T033-11: 強化 prompt truthfulness guardrails
**預計時間**: 30 分鐘

**執行內容**:
- 更新 `zentropy-agent.ts` 的 system prompt
- 更新 `query_tasks` skill promptInjection
- 明示：
  - 查詢回答只能根據 tool 結果
  - tool 若 partial / truncated，必須揭露
  - 問完成不能改答待辦
  - coverage 不完整時不得說成完全沒有

**交付物**:
- [ ] 系統 prompt 更新
- [ ] skill prompt 更新

---

### T033-12: 補 deterministic unit tests
**預計時間**: 1 小時

**測試情境**:
- [ ] `query_tasks` 對 completed intent 使用 completed query path
- [ ] `query_tasks` 對 todo intent 使用 today-focus query path
- [ ] formatter 會正確輸出總數、摘要、coverage
- [ ] 空結果與 partial coverage 的訊息不同

**交付物**:
- [ ] 新增或更新 unit tests

---

### T033-13: 補 deterministic integration tests
**預計時間**: 1.5 小時

**測試情境**:
- [ ] `completed_at` 在今天、`updated_at` 不在今天，仍查得到
- [ ] `updated_at` 在今天、`completed_at` 不在今天，不得算今日完成
- [ ] 今日完成 34 筆時，回覆包含總數與摘要訊號
- [ ] 完成後立即查詢看得到剛完成項目
- [ ] 跨時區日期邊界正確

**交付物**:
- [ ] integration tests 覆蓋真實場景

---

### T033-14: Live LLM smoke tests 調整
**預計時間**: 30 分鐘

**執行內容**:
- 保留 live LLM 測試作為 routing smoke test
- 降低對自然語言措辭的脆弱斷言
- 讓 correctness 主要由 deterministic tests 負責

**交付物**:
- [ ] live tests 不再承擔 correctness 主責

---

### T033-15: 全量驗證
**預計時間**: 20 分鐘

**必跑命令**:
```bash
cd api && npm run lint && npm run test && npm run build
```

**交付物**:
- [ ] lint 通過
- [ ] test 通過
- [ ] build 通過

---

## 4. 驗收標準 (Definition of Done)

- [ ] 使用者今天完成大量任務時，agent 不會回覆「今天沒有完成任何任務」
- [ ] `completed_at` 成為今日完成查詢的唯一時間依據
- [ ] LINE / REST / agent skill 的完成寫入語義一致
- [ ] `query_tasks` 不再自行定義第二套查詢規則
- [ ] 回覆大量結果時，會顯示總數並揭露摘要 / 截斷狀態
- [ ] `cd api && npm run lint && npm run test && npm run build` 全部通過

## 5. 實作順序建議

建議按以下順序執行：

1. T033-1 ~ T033-3
2. T033-4 ~ T033-7
3. T033-8 ~ T033-11
4. T033-12 ~ T033-15
