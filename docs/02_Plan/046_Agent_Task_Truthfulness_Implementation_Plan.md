# Agent Task Truthfulness Implementation Plan

**版本**: v1.1
**更新日期**: 2026-03-11
**對應 Spec**: [`015_Agent_Task_Truthfulness_Spec.md`](../01_Specification/015_Agent_Task_Truthfulness_Spec.md)
**目標**: 讓 LINE Agent 在「今天完成了什麼 / 今天要做什麼 / 標記完成」場景中，使用與主系統一致的事實來源，避免因資料口徑錯誤而輸出誤導性回覆。

---

## 1. 問題總結

目前 agent 的問題不是單純 prompt 寫得不夠好，而是整體路徑在以下幾點失去一致性：

1. 完成語義不一致
   - 不同完成路徑未統一寫入 `completed_at`
   - `status = ARCHIVE` 被誤當成足夠的完成證據

2. Query skill 與主系統資料口徑脫節
   - `query_tasks` 直接使用簡化 Prisma 查詢
   - 未重用既有 unified data collector / shared query logic

3. Tool contract 太弱
   - tool 只回自然語言，缺少結構化事實欄位
   - agent 模型看不到「總數 / 是否截斷 / 覆蓋範圍」

4. Prompt 缺少 truthfulness guardrails
   - 無法區分 zero-result 與 limited-coverage
   - 無法約束模型揭露查詢邊界

5. 測試覆蓋偏 demo happy path
   - 驗證 routing 成功，但未驗證真實查詢正確性
   - 沒有覆蓋 30+ 完成、跨時區、`completed_at != updated_at`

---

## 2. 技術目標

本計畫將完成以下五件事：

1. 建立一致的 Completion Semantics
2. 將 agent query 對齊 shared source of truth
3. 重構 tool 輸出 contract 為「結構化事實 + 可讀摘要」
4. 強化 prompt 只做表達控制，不再代替資料邏輯
5. 建立可回歸的真實場景測試集

補充修正軸線（2026-03-11）：

6. 建立 canonical tool response protocol，阻止 `[FACTS]` 洩漏到 user-facing reply
7. 把多輪指代解析改成「最近一次結構化實體集合」而不是回掃所有 assistant 摘要句
8. 把 planner `goal` 參數 ownership 收回 application 層，避免 provider function-calling 漏參

---

## 3. Target Architecture

### 3.1 Before

目前資料流：

```text
LINE Message
  -> NaruAgent
  -> query_tasks skill
  -> skill 內部直接查 prisma.task
  -> 回傳自然語言字串
  -> LLM 再組一句話回給使用者
```

缺點：

- 事實來源分散
- skill 自己定義完成規則
- 回覆內容沒有 coverage / total / truncation 訊號

### 3.2 After

目標資料流：

```text
LINE Message
  -> NaruAgent
  -> query_tasks skill
  -> AgentTaskQueryService
  -> Unified / Shared Task Fact Source
  -> 結構化 Query Result
  -> tool 產生 machine-readable facts + human summary
  -> LLM 僅忠實轉述，不自行補完
```

完成任務資料流：

```text
LINE / REST Complete Action
  -> Task Completion Use Case
  -> status = ARCHIVE
  -> completed_at = now
  -> shared repository semantics
  -> query_completed_today 可立即查到
```

---

## 4. 設計決策

### 4.1 Completion 寫入必須走共用語義

不允許在 agent skill 或 LINE webhook 中直接手寫局部 update 邏輯。

決策：

- 把「完成 Task」收斂到既有 task repository / use case 的語義層
- 所有完成操作統一保證：
  - `status = ARCHIVE`
  - `completed_at = now`
  - reopen 時清空 `completed_at`

理由：

- 避免 LINE、REST、內部腳本各寫一套
- 避免 query 與 write 對「完成」理解不同

### 4.2 Query 讀取必須走 shared fact source

Agent 不再自己拼 Prisma 查詢規則。

決策：

- 建立 `AgentTaskQueryService` 作為 Application 層共享查詢服務
- 初期可包裝既有 `unified-data-collector` 或 repository filter 能力
- skill 僅呼叫 service，不自行定義完成條件與排序規則

理由：

- 對齊 coaching / dashboard / reporting 口徑
- 避免 agent 成為第二套產品規則

### 4.3 Tool contract 改成 structured facts first

目前 tool 直接回字串，對 LLM 來說事實邊界太弱。

決策：

- tool 內部先組出結構化結果，再產生簡短摘要文字
- 結構至少包含：
  - `query_type`
  - `timezone`
  - `coverage`
  - `total_count`
  - `display_count`
  - `truncated`
  - `items`
  - `summary`

理由：

- 可測試
- 可直接在 prompt 中約束模型不得超出欄位內容
- 可支援未來前端或 MCP 直接消費

### 4.4 Prompt 只做 truthfulness guardrails

prompt 不再承擔資料修補責任。

決策：

- System prompt 與 skill prompt 只負責規定：
  - 查詢類回答不得超出 tool 結果
  - partial / truncated 必須揭露
  - 問完成不能答待辦
  - tool coverage 不完整時不得說成「沒有」

理由：

- 讓問題回到資料與 contract，而不是繼續堆提示詞

### 4.5 大量結果採摘要，不採假完整列舉

決策：

- 設定展示上限，例如前 10 筆
- 但總數永遠完整回傳
- 若結果很多，額外提供按 product / source type 的摘要

理由：

- 滿足 LINE 回覆長度限制
- 保留事實完整性

### 4.6 Canonical tool response 必須由 orchestration 層決定

決策：

- tool output 若包含 `[FACTS]` 區塊，只能寫入 history / trace
- 最終回覆一律使用 orchestration 層抽出的 human summary
- 對 side-effect intents，tool 已成功時，優先回傳 tool summary，不接受 LLM 自由改寫覆蓋

理由：

- `FACTS` 洩漏不是 prompt 細節，而是 final response assembly 把 raw tool output / step text 直接暴露給使用者
- truthfulness 需要把最終回覆所有權收回 orchestration

### 4.7 多輪指代只綁最近一次實體集合

決策：

- ordinal reference 只讀取最近一次真正列出的 items（query list 或 disambiguation list）
- 單一確認 preview 不得被當成新的 ordinal list
- brain dump / append 需寫入結構化 recorded items，供 recall 與 completion 共用

理由：

- 目前把所有 assistant mentions 混成同一個 pool，會讓「第二個」漂移到不相關候選
- append 類摘要句若沒有結構化 facts，後續 completion 會拿到整段說明文字而不是 task title

### 4.8 Planner goal extraction 不能交給 provider 猜

決策：

- `createRunPlannerTool()` 支援以原始 user message 作為 canonical input
- planning route 預設採 zero-arg tool，application 層自行正規化 goal
- planner 內層 `generateObject` schema 放寬為「最小可用欄位」，再由 post-processing 補預設值

理由：

- `goal=undefined` 與 schema mismatch 屬於兩層不同失真：外層 tool args 失真、內層 structured output 過脆
- 需要同時修 tool input ownership 與 planner output normalization

---

## 5. 實作分層

### 5.1 Domain / Repository 層

需要確認或調整：

- Task status transition 的完成語義是否已完整封裝
- repository update path 是否保證寫入 `completed_at`
- reopen path 是否保證清除 `completed_at`

若既有邏輯完整，優先重用；若邏輯分散，需收斂。

### 5.2 Application 層

新增或重構以下能力：

1. `AgentTaskQueryService`
   - 查詢今日完成
   - 查詢今日待辦
   - 回傳結構化 query result

2. `CompleteTaskUseCase` 或既有 use case adapter
   - 統一供 LINE / REST / agent skill 使用

3. `AgentResponseFormatter`
   - 將結構化 query result 轉成可讀摘要
   - 僅負責 presentation，不做查詢判斷

### 5.3 Interface 層

需改動：

- LINE webhook confirm flow
- agent query skill
- agent complete skill

原則：

- interface 層只做意圖轉接與訊息格式化
- 不直接實作業務規則

---

## 6. Data Contract Design

### 6.1 Query Result Schema

建議結構：

```ts
interface AgentTaskQueryResult {
  queryType: "completed_today" | "today_focus"
  timezone: string
  coverage: {
    tasks: boolean
    subTasks: boolean
    dailyPlanItems: boolean
  }
  totalCount: number
  displayCount: number
  truncated: boolean
  items: Array<{
    id: string
    title: string
    sourceType: "task" | "sub_task" | "daily_plan_item"
    productName?: string
    completedAt?: string
    dueDate?: string
    urgency?: "overdue" | "today" | "tomorrow" | "upcoming" | "unscheduled"
  }>
  groupedSummary?: Array<{
    label: string
    count: number
  }>
  summary: string
}
```

### 6.2 Tool Output Strategy

短期策略：

- `execute()` 仍回文字，維持與 `naru-agent-js` 的最小相容
- 但文字必須明確包含：
  - 總數
  - 是否部分列出
  - 覆蓋範圍

中期策略：

- 評估 naru-agent-js 是否支援把結構化 metadata 帶進 tool result
- 若可行，改為「metadata + summary」雙輸出

---

## 7. Query Strategy

### 7.1 今日完成

資料規則：

- 基於使用者時區計算今日範圍
- 以 `completed_at` 為唯一完成時間依據
- 支援至少 Task
- 若 SubTask / Daily Plan 已可取得，併入同一結果集

排序規則：

- `completed_at DESC`

摘要規則：

- 回傳總數
- 展示前 N 筆
- 若超過 N 筆，標示「以下列出部分項目」
- 可附 product grouping

### 7.2 今日待辦

資料規則：

- 從 shared fact source 取得 active / inbox / urgent context
- 不由 skill 自行拼 dueSoon + noDate 的簡化邏輯

排序優先：

1. 逾期
2. 今天到期
3. 明天或近期到期
4. 未排程但活躍項目

摘要規則：

- 先顯示高優先項目
- 保留總數與是否摘要的訊號

---

## 8. Prompt Plan

### 8.1 System Prompt 調整

新增明確規則：

1. 查詢類回答只能根據 tool 結果
2. 若 tool 指出僅部分覆蓋，不可說成完整查詢
3. 若結果被截斷，必須明說為摘要
4. 問完成不能改答成待辦

### 8.2 Skill Prompt 調整

`query_tasks`：

- completed intent 時，要求忠實回報：
  - 總數
  - 查詢來源
  - 是否部分展示

`complete_task`：

- 完成後回覆必須依 shared use case 的結果
- 不得用 local direct update shortcut

---

## 9. Testing Plan

### 9.1 Unit Tests

新增或調整：

1. `query_tasks` result formatting
2. `completed_today` query 使用 `completed_at`
3. `today_focus` summary formatting
4. prompt routing 對 completed / todo 的區分

### 9.2 Integration Tests

新增場景：

1. Task 今天完成，但 `updated_at` 不在今天，仍查得到
2. Task 今天被更新，但 `completed_at` 不在今天，不得算入今日完成
3. 今日完成 34 筆時，回覆必須包含 `34` 與摘要訊號
4. LINE confirm 完成後，立刻查詢今日完成可見
5. 跨時區邊界測試
6. 若尚未支援 SubTask / Daily Plan，空結果訊息需揭露 coverage

### 9.3 Regression Tests

建立 truthfulness regression set，覆蓋真實語句：

- 我今天完成了什麼？
- 我今天做了什麼？
- 今天有哪些事？
- 我把 XX 做完了
- 這個搞定了

---

## 10. 實作階段

### Phase 1: Completion Semantics Cleanup

目標：

- 統一所有完成寫入路徑

工作項目：

1. 找出所有 task archive / complete 入口
2. 收斂到 shared use case / repository semantics
3. 補 `completed_at` 與 reopen 測試

### Phase 2: Shared Query Service

目標：

- 建立 agent query 可重用的事實服務

工作項目：

1. 新增 `AgentTaskQueryService`
2. 接 unified data collector 或等價 shared query
3. 先支援 task completed_today / today_focus
4. 回傳結構化結果

### Phase 3: Skill Refactor

目標：

- 讓 query / complete skill 變成薄層

工作項目：

1. 重構 `query-tasks-skill.ts`
2. 重構 `complete-task-skill.ts`
3. 修改 LINE webhook confirm flow
4. 更新 promptInjection 文案

### Phase 4: Truthful Response Formatting

目標：

- 回覆大量資料時保持簡潔但不失真

工作項目：

1. 實作 summary formatter
2. 加入 total / truncation / coverage 語句
3. 驗證 LINE 回覆長度可接受

### Phase 5: Verification & Regression

目標：

- 用真實案例驗證修正不是表面補丁

工作項目：

1. 補 unit / integration tests
2. 跑 `npm run lint && npm run test && npm run build`
3. 人工驗證至少 3 個真實對話案例

---

## 11. 風險與對策

### 11.1 風險：shared fact source 與 agent 現有工具整合成本高

對策：

- 先用 application service 包裝既有 collector
- 不先重寫 naru-agent-js

### 11.2 風險：結構化結果過大，不適合 LINE

對策：

- 區分 internal result 與 user-facing summary
- 內部保留完整 facts，外部只展示摘要

### 11.3 風險：SubTask / Daily Plan coverage 尚未完整

對策：

- 先把 coverage 做成顯式欄位
- 第一版先確保 Task truthfulness，後續再擴充 coverage

### 11.4 風險：live LLM tests 不穩定

對策：

- 關鍵 correctness 以 deterministic integration tests 驗證
- live tests 只保留 routing smoke coverage

---

## 12. 驗收輸出

完成本計畫後，系統應交付：

1. 一致的 task completion semantics
2. 一個 shared `AgentTaskQueryService`
3. 重構後的 `query_tasks` 與 `complete_task`
4. 誠實揭露 total / coverage / truncation 的 agent 回覆
5. 可回歸的 truthfulness test suite

---

## 13. 完成定義

只有在以下條件全部成立時，本計畫才算完成：

1. 使用者今天完成大量任務時，agent 不會回覆「沒有完成任何任務」
2. `completed_at` 成為查詢今日完成的唯一時間依據
3. completion write path 與 query read path 語義一致
4. 對大量結果回覆摘要時，明確揭露是部分展示
5. 驗證命令全部通過：

```bash
cd api && npm run lint && npm run test && npm run build
```
