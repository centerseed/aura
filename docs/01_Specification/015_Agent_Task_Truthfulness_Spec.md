# Agent Task Truthfulness Specification

**版本**: v1.1
**更新日期**: 2026-03-11
**定位**: 修正 LINE Agent 在「今天做了什麼 / 今天要做什麼 / 完成任務」場景中的事實失真問題，建立可支撐真實使用的任務事實查詢規格。

---

## 1. 背景與問題定義

目前 Zentropy 的 LINE Agent 已具備以下能力：

1. 記錄任務與想法
2. 查詢今日任務
3. 標記任務完成
4. 規劃任務
5. 調整分類
6. 重整任務結構

然而，在真實使用中已出現以下失真案例：

- 使用者今天實際完成 30+ 項工作
- Agent 回覆「你今天似乎還沒有標記任何任務為完成」
- 或僅列出極少數任務，讓使用者誤以為系統沒有記錄

此問題不是單純的 LLM 幻覺，而是來自以下結構性缺陷：

- 「完成」事件的資料語義不一致
- Query skill 直接讀取簡化資料，而非使用系統事實來源
- Agent 回覆未揭露查詢邊界與資料範圍
- 測試僅覆蓋 happy path，未覆蓋高頻真實場景

本規格目標是讓 Agent 成為「可信的任務事實代理人」，而非僅是「會回話的 LINE Bot」。

---

## 2. 產品目標

### 2.1 核心目標

當使用者詢問：

- 我今天完成了什麼？
- 我今天做了什麼？
- 我今天要做什麼？
- 這個任務完成了

Agent 必須回覆與系統事實一致的結果，且不可因資料口徑錯誤而輸出誤導性結論。

### 2.2 成功標準

系統必須做到：

1. 對「完成」有唯一且可追溯的資料定義
2. 對「今天完成了什麼」使用統一事實來源，而非局部查詢
3. 面對 30+ 筆結果時仍能正確摘要，不假裝完整列舉
4. 回覆空結果時，必須是真的沒有，而不是查詢口徑太窄
5. 測試能覆蓋真實高頻場景，而非只驗證 prompt routing

---

## 3. 非目標

本規格不處理以下範圍：

- 新增一般對話型人格功能
- 開放自由問答查詢非任務資料
- 重寫全部 Agent orchestration 架構
- 引入新的外部 Agent framework
- 對 Product / Topic / Area 命名策略做大改版

---

## 4. 使用者故事

### 4.1 查詢今日完成

作為重度使用者，當我問「我今天完成了什麼？」時，我希望看到：

- 今天已完成事項的真實總數
- 主要完成內容摘要
- 若項目很多，看到前幾項與分組摘要
- 不會被錯誤告知「今天沒有完成任何任務」

### 4.2 查詢今日待辦

作為一般使用者，當我問「我今天要做什麼？」時，我希望看到：

- 今天真正需要優先處理的項目
- 逾期、今天到期、明天到期的清楚標記
- 若待辦過多，得到排序後的重點摘要

### 4.3 標記完成

作為使用者，當我說「這件事完成了」時，我希望：

- Agent 能正確找到目標任務
- 完成事件被正確寫入資料庫
- 之後「今天完成了什麼」能查得到這筆紀錄

---

## 5. 領域定義

### 5.1 完成事件（Completion Event）

「完成」不是單純 `status = ARCHIVE`。

系統中的完成事件定義為：

- 一個 Task、SubTask 或 Daily Plan Item 被標記完成
- 且有明確完成時間戳記
- 且此完成時間可用於按日查詢與統計

### 5.2 完成時間真相欄位

Task 的完成時間真相欄位為：

- `completed_at`

`updated_at` 僅表示該筆資料最近一次被修改，不能作為完成時間真相欄位。

### 5.3 今日完成清單

「今日完成清單」定義為：

- 完成時間落在使用者當地時區的今日範圍內
- 來源可包含：
  - Tasks
  - SubTasks
  - Daily Plan Items
- 回傳給 Agent 時，必須帶有來源型別與完成時間

### 5.4 今日待辦清單

「今日待辦清單」定義為：

- ACTIVE / INBOX 中與今日決策有關的項目
- 包含逾期、今天到期、近期到期、未排程但高相關項目
- 應由統一資料視圖計算，而非由單一 skill 任意拼接 SQL 規則

補充口徑：

- 若使用者明確詢問「今天還沒完成哪些」「今天還有什麼沒做」這類 strict-today 未完成查詢，回覆不得混入明天、近期或未排程項目
- strict-today 未完成查詢只允許包含逾期與今天範圍內仍未完成的項目
- 「今天要做什麼」這類較寬鬆的焦點查詢，才可以使用今日決策口徑納入近期與未排程項目

---

## 6. 功能需求

### FR-1 完成語義一致性

所有會把任務視為「完成」的流程，必須寫入一致的完成欄位。

具體要求：

1. Task 進入完成狀態時，必須寫入 `completed_at`
2. Task 被 reopen 時，必須清空 `completed_at`
3. LINE webhook 的完成確認流程不得繞過此語義
4. REST / internal use case / webhook 三條路徑的完成行為必須一致

### FR-2 今日完成查詢必須使用事實來源

Agent 查詢「今天完成了什麼」時，禁止直接以 `updated_at` 推論完成紀錄。

具體要求：

1. 查詢條件必須基於 `completed_at`
2. 查詢來源必須使用統一資料收集層或等價的 shared query service
3. 若資料來源尚未支援某類完成項目，Agent 回覆不得宣稱「沒有」
4. 回覆應可標示查詢覆蓋範圍，例如 Task / SubTask / Daily Plan

### FR-3 今日待辦查詢必須統一口徑

Agent 查詢「今天要做什麼」時，必須基於統一優先規則，而非簡化版 skill 私有邏輯。

具體要求：

1. 排序需考慮逾期、到期、近期與未排程
2. 與主系統 dashboard / coaching / reporting 的待辦口徑需一致
3. 不得只依最近更新時間任意截取少量任務作為「今日任務」
4. 若原句是在問「今天還沒完成 / 今天還有哪些沒做」，查詢必須切換為 strict-today 未完成口徑，不得沿用較寬的 focus bucket

### FR-4 大量結果摘要

當今日完成或今日待辦數量過多時，Agent 必須使用摘要策略，而不是假裝完整列出。

具體要求：

1. 回覆必須包含總數
2. 可列出前 N 筆，但需明示是摘要或部分展示
3. 應支援依 Product / 類型 / 緊急程度分組摘要
4. 當結果超過摘要門檻時，不得回覆成「只有這幾筆」

### FR-5 空結果回覆必須可信

只有在事實來源查詢結果為空，且查詢口徑已足夠完整時，Agent 才能回覆「今天沒有完成任何項目」。

具體要求：

1. 空結果訊息不得用模糊或推測語氣掩蓋資料不足
2. 若目前僅能查部分來源，應明確說明查詢範圍
3. 空結果訊息應避免與實際統計頁面矛盾

### FR-6 Tool truthfulness

Agent tool 的責任是提供「事實資料」，不是讓模型自行補完。

具體要求：

1. Tool 回傳需包含總數、來源範圍、是否截斷
2. Tool 不得只回自然語言字串而隱藏關鍵事實欄位
3. Agent prompt 必須要求模型忠實轉述 tool 結果，不自行推論缺失資料

### FR-7 Prompt truthfulness guardrails

系統 prompt 與 skill prompt 必須明示：

1. 查詢類回答不得超出 tool 證據
2. LINE user-facing 回覆必須優先追求手機可讀性，不得把內部能力、coverage、摘要直接堆成後台報表語氣
3. 能力介紹需改寫為短句式聊天文案，不使用過長工具名或括號解說
4. 任務清單需優先呈現「現在該知道的事」，例如總數、最重要的幾項、是否還有更多；coverage 說明僅能作為補充一句
5. 任務項目格式需降低括號密度，避免每一行同時堆疊 Product、SourceType 與 urgency 標記造成閱讀負擔
2. 當 tool 表示 partial / truncated 時，回答必須揭露
3. 當使用者問的是「完成了什麼」，不得改答成「待辦清單」
4. 當工具回空結果時，先判斷是 zero results 還是 limited coverage

### FR-8 可驗證性

本功能必須具備可回歸驗證的測試集。

最低覆蓋：

1. `completed_at` 與 `updated_at` 不一致場景
2. 30+ 筆今日完成場景
3. SubTask / Daily Plan Item 完成場景
4. 亞洲時區跨日邊界
5. 完成後立即查詢場景
6. 空結果與部分結果的回覆區分

### FR-9 Canonical tool response protocol

任何會先執行 tool、再回覆使用者的 agent 路徑，必須把 tool output 視為 canonical response source。

具體要求：

1. tool 可回傳 machine-readable facts 與 human summary，但 user-facing reply 只可使用 human summary
2. `[FACTS] ... [/FACTS]` 區塊只能存在於內部 history / trace，不得直接回傳給最終使用者
3. 一旦 tool 已成功執行，LLM 不得用自由生成文字覆蓋 tool 的關鍵決策結果
4. 對完成、規劃、分類等 side-effect 路徑，回覆內容必須以 tool 真實結果為準

### FR-10 Context entity extraction 必須依賴結構化事實

多輪對話中的「第一個 / 第二個 / 剛才記的那個」等指代，必須優先解析到結構化的上一輪實體，而不是回掃整段自然語言摘要。

具體要求：

1. ordinal reference 只可對應到最近一次真正列出的項目集合
2. completion preview 的候選或單一確認項目，不可污染原始 query list 的序號語意
3. brain dump / append 路徑必須在 history 中留下可抽取的結構化實體名稱
4. recall / completion 不得把整段 assistant 摘要句當成 task title 傳回搜尋

### FR-11 Planner parameter ownership

規劃路徑的 `goal` 參數必須由 application 層掌握，不可完全依賴 provider 的 function-calling 參數生成。

具體要求：

1. planning intent 一旦成立，原始 user message 必須可被 application 層還原成 planner goal
2. tool calling provider 若未可靠填入 `goal`，系統仍必須能以原始訊息完成規劃
3. planner 內層 structured generation schema 必須容忍 provider 的輕微欄位缺失，並由 application 層補齊 defaults
4. 系統不得把 `undefined` 或空字串帶入 planner prompt 或建立出的任務內容

---

## 7. 回覆規格

### 7.1 今日完成回覆格式

最少需包含：

- 今日完成總數
- 主要完成項目摘要
- 若有截斷，明示「以下列出部分項目」

範例語義：

- `你今天已完成 34 項。以下列出其中 10 項重點：...`
- `目前查到今天完成 12 項 Task 與 18 項 SubTask。`

### 7.2 今日待辦回覆格式

最少需包含：

- 當前優先待辦總數或摘要數量
- 明確標示逾期 / 今天 / 明天
- 若只是摘要，需清楚說明

### 7.3 空結果回覆格式

若真為空：

- `目前查到你今天還沒有完成任何 Task / SubTask / Daily Plan 項目。`

若僅部分覆蓋：

- `目前只查到 Task 完成紀錄，這部分今天沒有完成項目。`

---

## 8. 系統設計原則

### 8.1 Single Source of Truth

Agent 不應自行定義一套獨立於主系統的「今天完成」與「今天待辦」規則。

### 8.2 Domain Semantics First

Prompt 只能約束表達方式，不能彌補資料語義錯誤。

### 8.3 Honest Incompleteness

若目前資料覆蓋不完整，系統應誠實揭露，而不是輸出看似完整但實際誤導的答案。

### 8.4 Summary Without Distortion

摘要的責任是壓縮資訊，不是改寫事實。

### 8.5 Lexical-First Completion Resolution

completion search 屬於高風險 mutation 前置決策，不得在 skill 內使用 semantic / embedding 檢索。

必須依序採用以下分層：

1. `normalized exact`
   - 清除完成詞、語氣詞、助詞與空白變體後，比對 canonical task title
2. `fuzzy lexical`
   - 以可解釋的字串近似與 token/bigram overlap 進行候選排序
3. `clarification`
   - 若 top1 / top2 分數接近，必須要求使用者明確指定，不能自動完成或自動詢問單一候選
4. `single-turn execution`
   - 若 deterministic resolution 已收斂成單一候選，必須直接走 shared completion use case；不得一律退回 pending confirmation 等第二輪
5. `hybrid normalization fallback`
   - completion query normalization 應採 shared deterministic core + locale rules 為主；當輸出明顯可疑或 locale 規則無法穩定收斂時，可使用小型 structured LLM fallback 做 query normalization，但 fallback 不得取代 shared canonical path

---

## 9. 驗收標準

### AC-1

當使用者今天透過任一完成流程完成 Task，之後詢問「我今天完成了什麼」，必須查得到該 Task。

### AC-2

當 `updated_at` 與 `completed_at` 不一致時，系統仍必須依 `completed_at` 正確查詢。

### AC-3

當使用者今天完成 34 項內容時，Agent 不得回覆「沒有完成任何任務」，且回覆中必須包含總數或部分展示說明。

### AC-4

當結果超過展示上限時，Agent 必須明示為摘要，不得偽裝成完整清單。

### AC-5

當目前只覆蓋 Task、未覆蓋 SubTask / Daily Plan 時，Agent 的回覆必須揭露範圍限制。

### AC-6

所有 query/completion 相關測試需能在 CI 中穩定驗證，不依賴偶然的 prompt 表現。

### AC-7

當使用者輸入 `跑步跑完了`、`這個 done 了`、`週一跑步我做完了` 這類帶完成語氣的短句時，系統必須先做 normalization 與 lexical ranking，不能在 skill 中把原句送進 embedding query。

### AC-8

當 lexical top1 與 top2 過近時，系統必須回覆澄清清單，不得直接進入單一候選確認。

---

## 10. 實作約束

1. Query skill 不得直接複製主系統查詢邏輯形成第二套規則
2. 完成流程不得繞過 repository / use case 所定義的完成語義
3. Agent tool 的輸出結構必須可被測試直接驗證
4. 不得以增加 prompt 文案取代資料層修正
5. completion target resolution 必須優先使用 deterministic normalization 與 lexical matcher；skill 內不得計算或查詢 embedding
6. locale-specific completion phrasing 不得直接散落在多個 skill / agent；必須集中在 shared normalizer，並可選擇接一層 bounded LLM fallback

---

## 11. 後續產出

本規格核准後，後續需依序產出：

1. `02_Plan`：Agent Task Truthfulness Implementation Plan
2. `03_Tasks`：Atomic tasks for query/completion refactor
3. `Code`：重構 query skill、completion flow、shared query service、tests

---

## 12. 核心判準

若一個使用者今天明確完成了大量工作，Agent 絕對不能因為查錯欄位、查太少資料、或回覆時隱藏範圍限制，而告訴他「今天沒有完成任何任務」。

這是本規格的核心底線。
