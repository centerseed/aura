# Task 035: Agent Decision Architecture Program

**Status**: In Progress  
**Owner**: Codex / Antigravity  
**Dependencies**:
- [`docs/01_Specification/016_Agent_Decision_Architecture_Spec.md`](../01_Specification/016_Agent_Decision_Architecture_Spec.md)
- [`docs/02_Plan/048_Agent_Decision_Architecture_Redesign_Plan.md`](../02_Plan/048_Agent_Decision_Architecture_Redesign_Plan.md)

## 1. 目標

把 LINE Agent 從 regex / keyword 主導的 tool-first bot，重構為顯式 decision layer 主導的 agent system。

## 2. Program 分期

### Track A: Architecture Foundation

- intent schema
- decision trace
- canonical conversation state

### Track B: Completion Safety

- completion query / mutation collision 修正
- contextual completion target resolution
- confirm-first decision path

### Track C: Query / Capture Separation

- today-focus
- completed-today
- brain dump

### Track D: Prompt Compression

- system prompt
- skill prompt
- brain dump prompt

### Track E: Evaluation

- regression tests
- smoke tests

### Track F: Safety Kernel

- local invariants
- fallback entry criteria
- payload-safe routing
- execution-proof policy

### Track G: Role-Bounded Agent Assembly

- role-specific naru_agent factories
- deterministic vs agent boundary contracts
- context assembler

## 3. 本輪切入任務

### T035-1: 建立 canonical intent schema
- [ ] `AgentIntent` type
- [ ] `AgentDecisionTrace` type

### T035-2: 建立 deterministic intent resolver
- [ ] resolver interface
- [ ] completion/query collision rules

### T035-3: 先替換 completion intent resolution
- [ ] `ToolFirstAgent` 改接 intent resolver
- [ ] contextual completion lookup

### T035-4: 強化 LINE confirm path
- [ ] affirmative phrase matcher
- [ ] subtask / daily plan item completion confirm

### T035-5: 補 regression tests
- [ ] tool-first unit tests
- [ ] webhook-level regression tests
- [ ] confirmation matcher tests

### T035-6: 接上 query / capture separation
- [ ] shared capture matcher
- [ ] intent resolver 產出 `task_capture`
- [ ] `ToolFirstAgent` capture route 改由 intent 驅動
- [ ] webhook 對話 regression 覆蓋 contextual completion

### T035-7: 接上 structured decision fallback
- [ ] 升級 `naru-agent-js` 到 `0.1.2`
- [ ] 將 `LLMStructuredClassifier` 接進 intent resolver fallback
- [ ] 保持 executor / tool route 為 deterministic

### T035-8: 建立 Safety Kernel 第一批 invariant
- [x] 極短輸入不進 remote classifier
- [x] explicit capture frame 優先於 completion wording
- [x] payload identifier 不得誤觸 reorganize
- [x] post-execution verifier 阻擋無 execution proof 的完成態宣稱
- [x] failure class regression tests

### T035-9: 定義 role-bounded agent assembly
- [ ] 定義 `DecisionContext` contract
- [ ] 抽出 deterministic `Context Assembler`
- [ ] 定義 `decision-fallback-agent` factory
- [ ] 定義 `response-agent` factory
- [ ] 定義 `memory-aware-assistant` factory
- [ ] 補 layer contract tests

## 4. 驗收標準

至少覆蓋以下句型：

- `我今天已經跑完步了，幫我標記完成`
- `把這件事標記完成`
- `沒錯`
- `確認`
- `不是這個`
