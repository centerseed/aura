# LINE Agent Reorganization Flow Specification

**版本**: v0.2  
**更新日期**: 2026-03-12  
**定位**: 定義 LINE 使用者透過 Agent 進行「整理」時的絲滑互動流程，讓整理能力從單次 AI 分析改為可診斷、可編輯、可確認的提案式體驗。

---

## 1. 背景與問題定義

目前系統內的 `reorganize` 存在多條路徑：

1. Agent 偏向全域結構整理 preview
2. Web 仍保有全域重組 preview / confirm 流程
3. App 偏向 product 內 topic 重整與 apply

這使得 LINE 使用者在說「幫我整理一下」時，實際上會遇到以下問題：

- 不知道系統要整理的是今天任務、單一專案，還是整體結構
- 還沒理解現況前，就先收到一包整理建議
- 無法自然地對提案做局部修改
- 缺少穩定的「這個 / 第二個 / 最後一個」提案指代能力
- 執行前後缺少清楚的 proof 與範圍說明

因此，本規格的目標不是只新增一個 `reorganize` tool，而是定義一條符合 LINE 使用情境的整理對話流。

---

## 2. 產品目標

### 2.1 核心目標

當 LINE 使用者提出整理需求時，Agent 必須優先幫助使用者理解現況，再逐步推進到提案、微調與套用，而不是直接做黑盒重組。

### 2.2 成功標準

系統必須做到：

1. 使用者先看到「現在為什麼需要整理」
2. 使用者能逐條查看、拒絕、修改、局部執行整理提案
3. 使用者可用自然語言指代提案項目
4. 高風險 mutation 必須經過明確確認
5. 執行後回覆必須有 execution proof，而不是籠統說「已整理完成」

---

## 3. 非目標

本規格不處理以下範圍：

- 完整重新設計整個 LINE Rich Menu 導航資訊架構
- 一次統一所有 web / app / agent 的底層 use case
- 改寫所有現有 reorganize prompt
- 自動在未確認下直接套用高風險整理變更
- 對所有整理場景都引入長篇 explanation

---

## 4. 用戶心智與使用情境

### 4.1 用戶真正想知道的不是「模型分析結果」，而是「現在怎麼了」

當使用者說：

- 幫我整理一下
- 最近有點亂
- 哪些東西放錯了？
- 這個專案要不要整理？

其潛台詞通常是：

1. 先告訴我亂在哪裡
2. 再告訴我你建議怎麼改
3. 讓我用最少回覆就能修改或確認

### 4.2 LINE 的互動限制

LINE 上的整理體驗必須符合：

- 短訊息往返
- 上下文引用頻繁
- 使用者偏好逐步確認，而非閱讀完整報告
- 使用者常用「這個 / 第一個 / 最後一個 / 不要這個」做操作

---

## 5. 領域定義

### 5.1 整理（Reorganization）

本規格中的「整理」不是單一能力，而是以下三種 scope 之一：

1. `today_focus_cleanup`
   - 針對今天任務或近期待辦的輕量整理
2. `product_topic_reorganization`
   - 針對單一 Product 內 topic / task clustering / consolidation 的整理
3. `structure_governance_reorganization`
   - 針對整體 Area / Product / task placement 的全域治理整理

### 5.2 整理診斷（Reorg Diagnosis）

整理診斷是：

- 對當前 scope 的現況摘要
- 不帶 side effect
- 用於回答「現在哪裡需要整理」

### 5.3 整理提案（Reorg Proposal）

整理提案是：

- 一組可被引用、編輯、拒絕、確認的候選變更
- 每一項都必須有穩定識別資訊
- 每一項都必須可說明 impact 與 target

### 5.4 整理套用（Reorg Apply）

整理套用是：

- 將使用者已確認的 proposal item 轉為實際 side effect
- 執行後必須回傳已完成的變更數與範圍

---

## 6. 互動原則

### FR-1 先現況、後提案、再執行

使用者說「幫我整理一下」時，Agent 不得直接執行 mutation。

Agent 必須先完成以下順序：

1. 診斷現況
2. 提供少量候選提案
3. 接受使用者修改或確認
4. 執行已確認的提案

### FR-2 預設回覆必須短

LINE 上第一輪整理回覆應優先給：

1. 問題摘要
2. 候選數量
3. 下一步引導

第一輪不得直接輸出長篇報告，除非使用者要求看詳細內容。

### FR-3 Proposal item 必須可引用

只要 Agent 對使用者呈現整理提案，系統必須保存：

- proposal session id
- item ordinal
- item stable id
- item target summary
- item current status (`pending | edited | removed | applied`)

### FR-4 自然語言引用必須穩定解析

當最近一次對話已呈現 proposal list 時，以下回覆必須優先被解析為 proposal edit / apply 指令：

- 第一個
- 第二個不要
- 最後一個執行
- 這個改到個人
- 前兩個套用

若無法安全解析，Agent 必須要求澄清，而不是重新跑一次整理分析。

### FR-5 高風險套用必須 confirm-first

任何會造成資料移動、合併、刪除、topic rename、task consolidation 的操作，都必須在執行前明確確認。

### FR-6 回覆不得宣稱未證明的 side effect

未執行前只能說：

- 建議
- 提案
- 預覽
- 待確認

執行後才可說：

- 已移動
- 已合併
- 已套用

且必須有 execution proof。

### FR-7 LINE 上的確認與多選必須按鈕優先

當 Agent 已經知道下一步只剩少數明確選項時，LINE 回覆不得優先要求使用者手打固定格式指令。

必須遵守：

1. 單一確認場景
   - 例如「要不要記錄這一項」「是否套用這次調整」
   - 優先提供可點擊的確認 / 取消按鈕
   - 文字輸入只作為 fallback，不得成為主要路徑

2. 多候選選擇場景
   - 例如「你是指哪個任務」「有 2-3 個可能的完成項目」
   - 優先提供可點擊的候選按鈕或選單
   - 使用者點擊後應直接進入對應 mutation 或下一步確認，不應要求再手打一次任務名稱

3. 文案限制
   - 不得要求使用者輸入 `記錄：...`、`完成：...` 這類格式化前綴才能繼續
   - 若仍保留文字 fallback，必須接受自然語言確認與序號選擇

### FR-8 Button-first 不能破壞既有 truthfulness

按鈕式互動只是輸入介面替換，不得改變 side effect 的真實性要求。

因此：

1. 點擊「確認記錄」前，不得回覆「已記錄」
2. 點擊候選任務前，不得回覆「已完成」
3. 候選按鈕若直接觸發完成，該按鈕本身即視為明確使用者選擇
4. 任何按鈕觸發的完成 / 記錄 / 調整，回覆仍必須來自真實 use case 執行成功

---

## 7. BDD 場景

### Scenario 1: 使用者先了解現況，再決定是否整理

**Given** 使用者目前有多個可能需要整理的項目  
**And** Agent 尚未建立任何 pending reorg proposal  
**When** 使用者說「幫我整理一下」  
**Then** Agent 應先回答目前的整理現況摘要  
**And** Agent 應明示候選問題的數量與類型  
**And** Agent 應詢問是否要看建議內容  
**And** Agent 不得在此步驟直接執行 mutation

### Scenario 2: 使用者要求查看整理建議

**Given** Agent 已完成整理診斷  
**And** 系統已產生一組 proposal items  
**When** 使用者說「看建議」  
**Then** Agent 應顯示少量、可引用的 proposal items  
**And** 每項建議都必須有序號  
**And** 每項建議都必須簡述從哪裡改到哪裡  
**And** 若候選很多，Agent 只顯示前幾項並明示尚有剩餘項目

### Scenario 3: 使用者用序號拒絕單一提案

**Given** Agent 已向使用者列出 proposal items  
**When** 使用者說「第三個不要」  
**Then** Agent 應將第三個 proposal item 標記為 removed  
**And** Agent 應保留其餘 proposal items  
**And** Agent 應回覆更新後還剩哪些提案可執行  
**And** Agent 不得重跑全量整理分析

### Scenario 4: 使用者要求修改提案目標

**Given** Agent 已向使用者列出 proposal items  
**When** 使用者說「第二個改到個人」  
**Then** Agent 應將第二個 proposal item 進入 edited 狀態  
**And** Agent 應更新該 proposal item 的 target  
**And** Agent 應用更新後的提案向使用者回報  
**And** Agent 應等待確認，而不是直接套用

### Scenario 5: 使用者只想局部套用

**Given** Agent 有一組 pending proposal items  
**When** 使用者說「執行 1、2」  
**Then** Agent 應只選取第 1 與第 2 項作為 apply candidates  
**And** Agent 應先回覆本次將套用幾個變更  
**And** Agent 應要求使用者確認  
**And** 未被選取的 proposal items 必須保留在 pending state

### Scenario 6: 使用者確認執行整理

**Given** Agent 已整理出本次即將套用的 proposal subset  
**And** 使用者已收到確認摘要  
**When** 使用者回覆「確認」  
**Then** Agent 應執行對應 side effects  
**And** Agent 應回覆成功執行的變更數量  
**And** Agent 應區分哪些項目已執行、哪些未執行  
**And** Agent 應保留 execution proof 供後續查驗

### Scenario 7: 使用者使用上下文指代修改提案

**Given** Agent 最近一次只呈現單一焦點 proposal  
**When** 使用者說「這個不要」  
**Then** Agent 應將最近焦點 proposal 標記為 removed  
**And** Agent 應回覆是否要看其他候選建議

### Scenario 8: scope 不明時，Agent 先做輕量澄清

**Given** 使用者說「整理一下」  
**And** 系統無法從上下文安全判定是 today / product / global scope  
**When** Agent 進入整理診斷前  
**Then** Agent 應先用一句短問句澄清 scope  
**And** 問句應限制在少量可理解選項，例如今天任務、這個專案、整體結構  
**And** 澄清後才進入後續整理流程

### Scenario 9: 診斷無結果時，Agent 不建立空 proposal session

**Given** 使用者請求整理  
**When** 系統完成診斷但無需要調整的項目  
**Then** Agent 應明確說明目前沒有足夠證據需要整理  
**And** Agent 不得建立 pending reorg proposal  
**And** Agent 不得假裝生成建議

### Scenario 10: 使用者要求看詳細原因

**Given** Agent 已列出 proposal items  
**When** 使用者說「第二個為什麼？」  
**Then** Agent 應只解釋第二個 proposal item 的理由  
**And** 不得重新輸出整份報告  
**And** 解釋後應保留 proposal session 以便後續繼續操作

---

## 8. Agent State Requirements

### 8.1 Canonical Reorg Session State

只要 Agent 進入整理流程，session store 至少必須保存：

- `reorg_scope`
- `diagnosis_summary`
- `proposal_session_id`
- `proposal_items`
- `selected_item_ids`
- `last_focused_item_id`
- `pending_apply_confirmation`
- `last_execution_result`

### 8.2 Proposal Item Shape

每個 proposal item 至少必須具備：

- `id`
- `ordinal`
- `type`
- `source_summary`
- `target_summary`
- `reason_summary`
- `status`
- `risk_level`
- `editable_fields`

---

## 9. 回覆規範

### FR-7 第一輪整理回覆格式

第一輪回覆應優先長這樣：

1. 現況一句話摘要
2. 幾個候選問題
3. 是否查看建議

例如：

- 目前看到 3 個可能需要整理的地方：2 個任務放錯專案，1 組命名可能重複。要先看建議嗎？

### FR-8 Proposal list 回覆格式

列提案時，每項應盡量壓成一行，例如：

- 1. 把「LINE webhook 修復」移到「Zentropy API」
- 2. 把「整理報價單」移到「個人」
- 3. 合併「專案管理」和「項目管理」

並補一句可操作引導：

- 你可以回「執行 1、2」、「第三個不要」或「第二個改到個人」。

### FR-9 Apply confirmation 回覆格式

確認前應明示：

- 本次將套用的項目數
- 變更類型
- 是否還有未套用項目

### FR-10 Execution result 回覆格式

執行後應明示：

- 已執行幾項
- 略過幾項
- 是否還有剩餘候選

---

## 10. 邊界與風險

### 10.1 不得把每句「整理」都視為全域治理

若使用者正在某個 Product 脈絡下對話，預設應優先考慮 `product_topic_reorganization`，而不是直接跳到全域治理。

### 10.2 不得因 proposal edit 而遺失原始候選

使用者修改 proposal item 時，系統應保留：

- 原始建議
- 修改後建議
- 最終採用版本

以支援審計與回滾分析。

### 10.3 不得因局部操作而重置整個 session

像「第三個不要」、「第二個改到個人」這類指令，本質是對既有 proposal session 的增量編輯，不得重置為新的 diagnose 流程。

---

## 11. 實作指引

本規格預期後續 implementation plan 至少拆成三層：

1. `reorg_diagnose`
   - 回傳現況摘要與 proposal draft
2. `reorg_edit_proposal`
   - 處理序號引用、刪除、改目標、局部選取
3. `reorg_apply`
   - 處理確認與 side-effect execution

其中：

- Agent 只負責對話 orchestration 與 stateful proposal flow
- 真正的 reorg truth 應收斂到 shared use case / service
- Web / App / Agent 應盡可能共用 proposal model，而不是各自維護不同的整理語義

---

## 12. 驗收標準

以下情境若未通過，視為本規格未被滿足：

1. 使用者說「幫我整理一下」後，Agent 直接執行 mutation
2. Agent 列完提案後，無法理解「第二個不要」
3. 使用者說「執行 1、2」後，Agent 無法局部套用
4. 執行前沒有明確確認
5. 執行後回覆沒有 proof，只說「已整理完成」
6. 修改單一 proposal item 後，整個 proposal session 被重置
