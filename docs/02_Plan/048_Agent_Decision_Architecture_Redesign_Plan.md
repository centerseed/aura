# Agent Decision Architecture Redesign Plan

**版本**: v1.0  
**更新日期**: 2026-03-10  
**對應 Spec**: [`016_Agent_Decision_Architecture_Spec.md`](../01_Specification/016_Agent_Decision_Architecture_Spec.md)

## 1. 背景

目前 LINE Agent 同時受兩套決策來源控制：

1. `ToolFirstAgent` 的 regex / keyword direct routing
2. `NaruAgent + skills + prompt injection`

由於前者優先，導致高風險輸入常在 prompt 前就被誤判。

## 2. 重構策略

本計畫分三層收斂：

1. 明確決策層
2. 明確狀態層
3. 壓縮 prompt 職責

## 3. 目標架構

### Layer 0: Safety Kernel

deterministic gate，先處理：

- short underspecified input
- confirmation / rejection
- explicit capture framing
- pending session transition

### Layer 1: Context Assembler

deterministic 組裝：

- session summary
- last listed items
- last resolved target
- pending confirmation payload

只提供 context，不做執行裁決。

### Layer 2: Intent Resolver

輸入：

- raw message
- `DecisionContext`

輸出：

- speech act
- object
- target reference mode
- temporal scope
- requires confirmation
- confidence
- reason codes

runtime 原則：

- deterministic-first
- `naru_agent` 只作 structured fallback classifier

### Layer 3: Target Resolver

負責從 task / subtask / daily plan item / previous mention 中找候選， ambiguity 時回傳候選而不是猜答案。

### Layer 4: Executor

依 resolved intent 呼叫 shared use case：

- capture -> brain dump pipeline
- query today -> task query service
- query completed -> task query service
- complete -> task / subtask / plan item use cases
- adjust -> adjustment use case

### Layer 5: Response Generator

只負責把已決定的結果說清楚。可用 template 或 `naru_agent` response role，但不得新增 execution 未證明的事實。

### Layer 6: Post-Execution Verifier

deterministic 檢查：

- 是否真的有 side effect
- 是否真的成功
- 回覆語氣是否和 execution result 一致

### `naru_agent` 角色配置原則

允許多個 `naru_agent` 實裝，但每個都要 bounded by role：

- `decision-fallback-agent`
- `response-agent`
- `low-risk-orchestrator`
- `memory-aware-assistant`

以下層不做成 agent：

- safety kernel
- context assembler
- target resolver
- executor
- post-execution verifier

## 4. 實作分期

### Phase 1: Foundation

- 建立 intent schema
- 建立 conversation state schema
- 建立 decision trace contract
- 建立 intent resolver interface

### Phase 2: Completion Safety

- completion query / mutation collision 不再靠 regex 順序
- contextual completion 改走 target resolution
- LINE confirm path 成為一級 decision path

### Phase 3: Query / Capture Separation

- `today focus`
- `completed today`
- `brain dump`

改由 explicit intent 做分流。

本輪延伸切入：

- `brain_dump` 改由 shared capture matcher + intent resolver 判斷
- `ToolFirstAgent` 不再混用 resolver 與獨立 capture regex
- webhook regression 補上「列清單 → contextual completion → confirm」對話流
- `naru-agent-js@0.1.2` 的 `LLMStructuredClassifier` 僅作 deterministic resolver 的 fallback decision runtime

### Phase 4: Prompt Compression

- system prompt 收斂
- skill prompt 收斂
- brain dump prompt 分階段

### Phase 5: Evaluation

- webhook regression suite
- local conversation harness
- real-LLM smoke pack

### Phase 6: Safety Kernel

- local invariants before fallback LLM
- capture/completion collision policy
- payload identifier leakage protection
- effect-claim policy
- post-execution response verification
- regression pack by failure class, not by isolated sentence

### Phase 7: Role-Bounded `naru_agent` Assembly

- define per-role agent factories
- split decision fallback / response / memory-aware roles
- keep truth-boundary layers deterministic
- add contract tests between layers

## 5. 本輪交付

本輪先實作 Phase 1 + Phase 2 的第一批：

1. `ToolFirstAgent` 接上 intent resolver
2. completion target resolution 支援 contextual reference
3. LINE `confirm` / `沒錯` / `對` 等確認語句攔截
4. subtask / daily plan item completion confirm path
5. 對應 unit 與 webhook-level regression tests

## 6. 下一切片

先落地 Safety Kernel 的最小核心：

1. 極短輸入不進 remote classifier
2. explicit capture framing 優先於 completion / reorganize wording
3. baseline failure classes 轉成固定 regression tests
4. 在 agent runtime 回覆出口加入 effect-proof verifier

再下一切片：

1. 定義 `DecisionContext` contract
2. 抽出 deterministic `Context Assembler`
3. 將 `naru_agent` 工廠拆成 role-bounded factories
