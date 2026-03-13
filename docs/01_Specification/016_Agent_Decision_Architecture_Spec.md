# Agent Decision Architecture Specification

**版本**: v1.0  
**更新日期**: 2026-03-12  
**定位**: 將 Zentropy LINE Agent 從 regex / keyword 主導的 tool-first bot，重構為顯式 decision layer 主導的 agent。

## 1. 問題定義

目前 agent 的主要風險不是單一 prompt 不夠強，而是高風險決策在 prompt 之前就已經被 regex 決定：

1. 使用者輸入先被 query / complete / brain dump pattern 攔截
2. prompt 無法修正上游誤判
3. session history 以自然語言摘要為主，缺少 canonical state
4. query 與 mutation 容易互相污染，尤其是 completion wording

## 2. 產品目標

1. 任何輸入先解析成顯式 intent，而不是先被 regex 強制路由
2. Query 與 Mutation 在 decision layer 被嚴格區分
3. Prompt 只負責表達，不負責猜意圖或補事實
4. Canonical dialogue state 以 machine state 為主
5. 高風險操作必須可追蹤「為何被判成這個 intent」

## 3. 非目標

- 不一次重寫所有 agent framework
- 不一次移除所有低風險 shortcut
- 不在本階段改 LINE UI / Rich Menu
- 不把 brain dump 全部一次重做完

## 4. 第一性原理

### 4.1 先判斷使用者要世界發生什麼改變

最小問題不是「看到了什麼關鍵字」，而是：

- 在查詢狀態？
- 在要求系統改變狀態？
- 在澄清、確認、補充上一輪？

### 4.2 Prompt 不應承擔不可驗證的核心決策

如果錯誤後無法追查是 regex、skill、prompt 或 tool truthfulness 出問題，代表架構失敗。

### 4.3 Mutation 比 Query 更嚴格

當一句話同時包含時間詞、完成詞、任務詞與執行請求時，不得因 query regex 先命中就走查詢。

## 5. 目標架構

### 5.1 三段式決策流

1. `Intent Resolver`
2. `Target Resolver`
3. `Executor + Response Generator`

### 5.2 Canonical Intent Schema

每次解析至少輸出：

- `object`: `task_capture | task_completion | today_focus | completed_today | classification | planning | unknown`
- `requires_confirmation`: boolean
- `confidence`: 0-1

以下資訊若需要保留，應放在 `decision trace`，而不是膨脹主 schema：

- speech act
- target reference mode
- temporal scope
- reason codes

### 5.3 Canonical Conversation State

session store 應優先保存：

- last intent
- last resolved entities
- pending confirmation payload
- last query fact identifiers
- clarification context

## 6. Routing 規範

### FR-1 Regex 不得直接裁決高風險 mutation

regex / keyword 只能作為：

- 低風險 shortcut
- 候選意圖提示
- obvious meta query fast path

補充規則：

- 同一類 fast-path（例如 explicit capture frame / non-capture guard）只能有 **單一 shared implementation**
- skill prompt / skill runtime 不得再各自維護第二份 query-vs-capture、query-vs-completion 的 regex 分流
- keyword / regex 不得直接覆寫 append-vs-create 這類 mutation semantics；若需要判斷，必須透過單一 shared resolver 或結構化 decision

以下不得由 regex 直接裁決：

- task completion
- adjust tags
- ambiguous contextual reference
- completed-today query vs complete action collision

### FR-2 Query / Mutation collision 先做 intent resolution

例如：

- `我今天已經跑完步了，幫我標記完成`
- `這件事今天做完了`
- `我今天完成了跑步，幫我勾掉`
- `信已經發出去給客戶了`

都必須先走 intent resolver。

補充規則：

- `已經 … 了`、`剛 … 了` 這類完成敘述若 shared completion normalizer 可萃出穩定 task query，必須視為 `task_completion`
- 這類完成敘述的 coverage 必須收斂在 shared completion normalizer / structural parser，不得在 intent resolver、skill、prompt 各自補 phrasing 白名單
- 若 completion search 對這類完成敘述收斂到高信心單一候選，LINE UX 必須進入 completion confirmation quick reply，而不是 brain-dump confirmation
- completion confirmation 的預設 quick reply 為 `確認完成 / 不是這個 / 取消`；`不是這個` 應清除 pending completion 並要求使用者提供更精確任務名稱或改選其他候選

### FR-3 Confirm / Clarify 是一級意圖

像 `沒錯`、`對`、`好的`、`不是這個`、`是上一個`，不得當成一般文字送進 agent。

### FR-4 Recall phrasing variation 不得退化成 capture

像 `我剛才記了什麼`、`你幫我記了什麼`、`剛剛記的是什麼` 這類問句，本質是 query / recall。

規則：

- 不得因為出現 `記`、`幫我記` 片段就退化成 `task_capture`
- recall fast-path 與 non-capture guard 必須覆蓋第二人稱、口語與時態變體
- 若找不到最近一次 recorded item，只能回覆查無紀錄，不能幻想建立新任務

### FR-5 清單指代未解開時要回到 list clarification

### FR-6 Query fast-path 必須覆蓋 negative pending phrasing

像 `今天還有什麼事沒做`、`今天還沒完成哪些`、`還有哪些沒做完` 這類句子，本質是 `today_focus`，不是 `completed_today`。

規則：

- `today_focus` fast-path 不得只覆蓋 `今天要做什麼` 這種正向問法
- 只要語意是在問剩餘 / 未完成 / 還沒做的項目，就必須路由到 `today_focus`
- `completed_today` 只接受明確詢問已完成內容的 phrasing，不得靠模糊的 `今天.*做了什麼` 類比去吞掉 negative pending query

### FR-7 `待辦` capture frame 必須要求有效 payload

`待辦` / `todo` 只能在「明確記錄框架」下觸發 `task_capture`，不得因為單獨一個標頭或模糊詞就建立任務。

規則：

- `待辦：買牛奶`、`待辦 買牛奶`、`待辦\n10:00 銀行繳稅` 應視為 explicit capture frame
- 單獨 `待辦`、`todo` 不得視為 capture，應交給後續 resolver / clarifier
- `今天待辦`、`今天 待辦`、`有哪些待辦` 這類 query phrasing 必須優先保留為 `today_focus`

像 `第一個`、`第三個`、`最後一個`、`剛剛那個` 這類完成語句，若明確承接最近一次 canonical list，Target Resolver 必須優先用該 list 做解析。

規則：

- 可安全解析時，直接綁定該 list item
- `最後一個` / `最後那個` 屬於 canonical list tail reference；只要最近 canonical list 存在且未歧義，必須直接解析為末位 item
- 無法安全解析時，必須明說「你是指清單中的哪一個」並要求回覆序號或完整名稱
- 不得把 `最後一個` 原句直接丟進 semantic search 後再回 `請確認名稱`

## 7. 第一批實作範圍

本輪先落地：

1. Canonical intent / decision trace 型別
2. Deterministic intent resolver interface
3. completion flow 的 query / mutation 拆分
4. LINE confirm-first decision path 強化
5. webhook-level regression tests

## 8. Decision Runtime Strategy

- deterministic resolver 是第一層 guardrail，優先處理高信心 / 高風險 collision
- 對 deterministic 無法安全判定的輸入，可使用 `naru-agent-js@0.1.2` 的 `agent.decide + LLMStructuredClassifier` 作為 fallback decision runtime
- structured classifier 只能輸出 canonical intent，不得直接執行 tool 或產生最終回覆
- target resolution 與 execution 仍維持 deterministic service / use case
- 已知 intent 的執行權必須收斂在單一 control plane；不得在 executor 再做第二輪 prompt switching 與 tool gating

### 8.1 `naru_agent` 的定位

`naru_agent` 不是整個系統本身，而是可插拔的 agent runtime building block。

它適合承擔：

- fallback decision runtime
- response generation
- memory-aware dialogue assistance

它不應承擔：

- safety kernel
- canonical state machine
- target resolution truth
- side-effect execution truth
- post-execution proof checking

### 8.2 系統分層與責任邊界

#### Layer 0: Safety Kernel

- 性質：deterministic
- 職責：攔截極短輸入、confirm / reject、明確 capture frame、pending session
- 輸入：raw message、pending session state、minimal metadata
- 輸出：`allow | block | direct_intent | direct_action`
- 規則：不得依賴 remote LLM

#### Layer 1: Context Assembler

- 性質：deterministic
- 職責：整理 session summary、last listed items、pending confirmation、last resolved target
- 輸入：session history、summary store、canonical state
- 輸出：`DecisionContext`
- 規則：提供 context，不做最終執行決策

#### Layer 2: Intent Resolver

- 性質：deterministic-first，可選 `naru_agent` fallback
- 職責：輸出 canonical intent
- 輸入：raw message、`DecisionContext`
- 輸出：`AgentIntent`
- 規則：fallback 只可分類，不可直接執行

#### Layer 3: Target Resolver

- 性質：deterministic
- 職責：把 explicit / contextual 指代解析成 task / subtask / plan item 候選
- 輸入：`AgentIntent`、`DecisionContext`、search candidates
- 輸出：`ResolvedTarget | AmbiguousCandidates | NotFound`
- 規則：ambiguity 時回傳候選，不得猜測

#### Layer 4: Executor

- 性質：deterministic
- 職責：呼叫 use case / tool，產生 side effect 或 query result
- 輸入：`ExecutionRequest`
- 輸出：`ExecutionResult`
- 規則：不做自然語言推理

#### Layer 5: Response Generator

- 性質：可用 `naru_agent` 或 template
- 職責：把已確定的 intent / result 說清楚
- 輸入：`ExecutionResult | ClarificationResult | CandidateList`
- 輸出：user-facing reply
- 規則：不得新增未被 execution/result 證明的事實

#### Layer 6: Post-Execution Verifier

- 性質：deterministic
- 職責：檢查回覆是否與 execution result 一致
- 輸入：reply、`ExecutionResult`、trace
- 輸出：`verified_reply | verification_error`
- 規則：若聲稱 side effect，必須有 execution proof

### 8.3 `naru_agent` 適合扮演的角色

同一個產品可有多個 `naru_agent` 實裝，但每個實裝只能承擔單一受限角色：

1. `Decision Fallback Agent`
   - 用途：deterministic 無法安全判定時做 structured classification
   - 禁止：直接執行 tool、直接產生完成態回覆
2. `Dialogue / Response Agent`
   - 用途：將已知結果轉成自然語言
   - 禁止：改寫 execution truth、補 invent facts
3. `Memory-Aware Assistant`
   - 用途：需要 summary / memory 時提供補充對話能力
   - 禁止：覆寫 canonical state

### 8.4 不應 agent 化的層

以下層應維持 deterministic service，而不是做成 agent：

- Safety Kernel
- Context Assembler
- Target Resolver
- Executor
- pending confirmation state machine
- Post-Execution Verifier

原因不是這些層「不智慧」，而是它們承擔 truth boundary、policy boundary、或 effect boundary。

### 8.5 架構判準

若某一層符合以下任一條件，預設不得直接用 `naru_agent` 取代：

- 要決定是否產生 side effect
- 要保證 target truth
- 要保證 session state transition
- 要保證回覆與 execution proof 一致

反過來說，若某一層的工作是：

- 在已知邊界內做分類
- 在已知事實內做表達
- 在低風險場景改善體驗

則可考慮用 `naru_agent` 選配實裝。

## 9. Safety Kernel Principles

### SK-1 Local invariants outrank fallback LLM

以下輸入類型不得直接進 remote structured classifier：

- underspecified short inputs
- explicit confirmation / rejection
- explicit capture framing
- explicit high-risk mutation framing

### SK-2 Capture framing bounds execution

若輸入具有明確 capture frame（例如 `待辦`、`幫我記`、`新增任務`），即使同句包含 `完成`、`整理`、代號或其他 payload-like token，也必須優先視為 `task_capture` 或 `unknown`，不得直接落到：

- `task_completion`
- `reorganize`
- `classification`

除非同句同時具備明確的 mutation target 與 completion command。

### SK-3 Payload content must not leak into routing

當輸入是「記錄某段內容」，其 payload 內的代號、branch、ticket、task code、檔名、英文 token、或動詞字串，不得被當成 routing 的主依據。

### SK-4 Effect claim requires execution proof

任何聲稱「已完成」「已記錄」「已更新」的回覆，必須以成功執行 tool / use case side effect 為前提。若未執行成功，只能回：

- clarification
- preview
- candidate list
- failure explanation

### SK-5 Post-execution verifier is a runtime boundary

在 agent response 離開 execution path 前，必須有一層 deterministic verifier 檢查：

- 回覆是否宣稱 side effect
- 是否存在對應 execution proof
- 若無 proof，必須阻擋該回覆並轉為 error / safe failure response
