# Naru Agent Modular System Assembly Plan

## 1. Background

Zentropy 現有 agent 能力不是單一 `naru_agent` 實例帶出來的，而是由多層 deterministic orchestration、bounded-role agent、session/message protocol、tool execution 與 verification 組成。

現況已經有部分雛形：

- `naru_agent` 被當成 bounded runtime building block，而不是整個系統
- 已有 role-bounded factories
- 真正的 correctness boundary 仍在 deterministic orchestration

相關現況可見：

- `docs/01_Specification/016_Agent_Decision_Architecture_Spec.md`
- `api/src/application/use-cases/agent/agent-factories.ts`
- `api/src/application/use-cases/agent/tool-first-agent.ts`
- `api/src/application/use-cases/agent/lifecycle-aware-agent.ts`
- `api/src/application/use-cases/agent/agent-execution-verifier.ts`

本文件的目標，是定義如何把這套架構抽象成可重複組裝的模組化系統，讓未來可以藉由設定 prompt、capability、message protocol 與 deterministic policy，快速重建一個產品級 agent system。

## 2. Problem Statement

若只把現有能力抽成「prompt 設定檔 + skills 清單」，只能重用表層人格與工具掛載，無法重建實際可用的 agent 行為。

原因是現有價值來自以下結構，而不是 prompt 本身：

1. safety kernel 先攔截高風險或極短輸入
2. context assembler 提供 canonical session context
3. intent resolver 先走 deterministic，再走 bounded fallback
4. target resolution 與 executor 決定實際 truth
5. response agent 只能在已證明事實上表達
6. post-execution verifier 阻止 effect claim hallucination

因此要抽象的不是「單一 agent」，而是「multi-layer agent system assembly」。

## 3. Goals

1. 定義一個可產品化的 `agent system assembly` 模型
2. 讓 `naru_agent` 可以作為多角色 runtime 的底座
3. 將 prompt、tool、memory、routing、policy 轉成可配置 contract
4. 保留 truth-boundary layers 為 deterministic service
5. 讓新產品能以最少程式碼組裝出可用的 agent system

## 4. Non-Goals

1. 不把 safety kernel 改成 LLM-driven
2. 不把 target resolver/executor/verifier 改成 prompt-only 配置
3. 不追求「完全零程式碼」建出高風險 mutation agent
4. 不要求所有產品共用同一套 intent schema

## 5. Design Principles

### 5.1 Role boundedness

每個 `naru_agent` 實例只能承擔單一受限角色，不得同時持有 routing truth、execution truth 與 final expression truth。

### 5.2 Deterministic truth boundaries

凡是涉及以下責任，必須維持 deterministic：

- side-effect execution truth
- target resolution truth
- session state transition truth
- post-execution proof verification

### 5.3 Configurable where stable, coded where safety-critical

穩定且可描述的部分用設定檔表達：

- role prompt
- tool registry
- memory policy
- routing thresholds
- message protocol shape

高風險 correctness 邏輯仍保留程式實作：

- safety kernel
- resolver fallback gate
- target resolution
- executor
- verifier

### 5.4 Contract-first assembly

模組化的核心不是 prompt，而是每層輸入輸出 contract。

## 6. Proposed Module Architecture

目標架構分成三層：

### 6.1 Layer A: `naru-agent-core`

責任：

- single-agent runtime
- model adapter
- session store / summary store wiring
- memory manager wiring
- guardrail wiring
- structured classifier adapter
- role-scoped agent factory base

這一層不理解產品 intent，也不決定工具 truth。

### 6.2 Layer B: `naru-agent-system`

責任：

- orchestration pipeline
- role assembly
- decision context contract
- tool result protocol
- conversation state protocol
- safety kernel interface
- intent resolver interface
- target resolver interface
- executor interface
- verifier interface
- lifecycle hooks

這一層是 reusable system assembly framework。

### 6.3 Layer C: product package

責任：

- product intents
- prompts
- tool definitions
- policy thresholds
- channel adapters
- product-specific deterministic resolvers/executors/verifiers

Zentropy 應落在這一層。

## 7. Target Runtime Layers

### 7.1 Deterministic layers

必須由 system assembly 明確保留以下抽象介面：

1. `SafetyKernel`
2. `ContextAssembler`
3. `IntentResolver`
4. `TargetResolver`
5. `Executor`
6. `PostExecutionVerifier`

### 7.2 Agent layers

可由 `naru_agent` 實裝以下角色：

1. `DecisionFallbackAgent`
2. `ResponseAgent`
3. `MemoryAwareAssistant`

### 7.3 Optional role

`LowRiskOrchestrator` 可存在，但只能處理低風險 query / clarification，不得直接跨過 deterministic truth boundary。

## 8. Core Contracts

### 8.1 Agent system config

```ts
type AgentSystemConfig = {
  systemName: string
  roles: {
    decisionFallback?: RoleConfig
    response: RoleConfig
    memoryAssistant?: RoleConfig
    lowRiskOrchestrator?: RoleConfig
  }
  protocols: {
    decisionContext: DecisionContextProtocol
    conversationState: ConversationStateProtocol
    toolResult: ToolResultProtocol
    replyVerification: ReplyVerificationPolicy
  }
  routing: {
    intentSchema: JsonSchema
    deterministicFirst: boolean
    classifierFallbackThreshold: number
    shortInputPolicy: "block" | "clarify" | "local_only"
  }
  tools: ToolRegistration[]
  policies: {
    confirmation: ConfirmationPolicyConfig
    truthfulness: TruthfulnessPolicyConfig
    memory: MemoryPolicyConfig
    lifecycle: LifecyclePolicyConfig
  }
  services: {
    safetyKernel: SafetyKernel
    contextAssembler: ContextAssembler
    intentResolver: IntentResolver
    targetResolver: TargetResolver
    executor: Executor
    verifier: PostExecutionVerifier
  }
}
```

### 8.2 Role config

```ts
type RoleConfig = {
  name: string
  instructions: string[]
  model: ModelRef
  enabledTools?: string[]
  summaryEnabled?: boolean
  memoryMode?: "off" | "each_turn" | "idle_flush"
  guardrails?: GuardrailRef[]
  outputMode?: "free_text" | "structured"
}
```

### 8.3 Decision context

`DecisionContext` 必須是 deterministic assembled object，不得由 LLM 自行推測。

最小欄位：

```ts
type DecisionContext = {
  sessionId: string
  pendingConfirmation: PendingConfirmationState | null
  lastListedItems: LastListedItem[]
  lastResolvedTarget: ResolvedTarget | null
  lastIntent: CanonicalIntent | null
  clarificationContext: ClarificationContext | null
  sessionSummary?: string | null
}
```

### 8.4 Tool result protocol

所有工具執行後，都必須輸出 canonical result：

```ts
type ToolExecutionResult = {
  toolName: string
  kind: "query" | "mutation" | "clarification" | "preview"
  status: "success" | "not_found" | "ambiguous" | "blocked" | "error"
  humanSummary: string
  facts?: Record<string, unknown>
  entities?: PresentedEntity[]
  proof?: {
    mutationApplied?: boolean
    targetIds?: string[]
  }
}
```

`ResponseAgent` 只能根據 `humanSummary + facts + proof` 組織語言，不得脫離 canonical result 自由發揮。

## 9. Assembly Flow

### 9.1 System boot sequence

1. load `AgentSystemConfig`
2. initialize shared runtime dependencies
3. create deterministic services
4. create role-bounded agents from role configs
5. build orchestrator pipeline
6. expose product-facing `chat()` entry

### 9.2 Message handling pipeline

1. `SafetyKernel.inspect(rawMessage, sessionState)`
2. 若可 direct route，直接進 deterministic path
3. `ContextAssembler.assemble(...)`
4. `IntentResolver.resolve(message, context)`
5. `TargetResolver.resolve(intent, context)`
6. `Executor.execute(request)`
7. `ResponseAgent.respond(result)`
8. `PostExecutionVerifier.verify(reply, result, trace)`
9. persist state, trace, turn log

### 9.3 Fallback rules

LLM fallback 只能出現在以下位置：

1. deterministic intent resolver 無法安全判斷時
2. response formatting 需要自然語言表達時
3. memory-aware low-risk assistance 時

不得出現在以下位置：

1. 是否應產生 side effect
2. target ambiguity 是否可猜測
3. 是否真的執行成功

## 10. Factory Design

### 10.1 Core factory

提供一個 assembly-level factory：

```ts
interface AgentSystemFactory {
  create(config: AgentSystemConfig): AgentSystem
}
```

### 10.2 Internal factories

```ts
interface RoleAgentFactory {
  createDecisionFallback(config: RoleConfig, runtime: SharedRuntime): AgentLike
  createResponse(config: RoleConfig, runtime: SharedRuntime): AgentLike
  createMemoryAssistant(config: RoleConfig, runtime: SharedRuntime): AgentLike
}

interface DeterministicServiceFactory {
  createSafetyKernel(config: AgentSystemConfig): SafetyKernel
  createContextAssembler(config: AgentSystemConfig): ContextAssembler
  createIntentResolver(config: AgentSystemConfig, deps: ResolverDeps): IntentResolver
  createTargetResolver(config: AgentSystemConfig): TargetResolver
  createExecutor(config: AgentSystemConfig): Executor
  createVerifier(config: AgentSystemConfig): PostExecutionVerifier
}
```

### 10.3 Product assembly output

```ts
type AgentSystem = {
  chat(input: ChatInput): Promise<ChatOutput>
  inspect(): AgentSystemInspection
}
```

## 11. What Should Be Configurable

以下應可用設定檔控制：

1. role prompt 與 model
2. tool enablement
3. memory mode
4. guardrail enablement
5. classifier threshold
6. channel-specific wording policy
7. logging / tracing level
8. reply formatting style

## 12. What Must Remain Code

以下必須保留程式實作：

1. safety kernel 規則本體
2. target resolution 邏輯
3. tool execution 與 use case binding
4. execution proof 產生與驗證
5. high-risk confirmation state machine
6. cross-turn reference resolution

## 13. Zentropy Mapping

Zentropy 現有結構可映射如下：

- `agent-factories.ts` -> role agent factory 雛形
- `tool-first-agent.ts` -> orchestration pipeline 雛形
- `agent-context-assembler.ts` -> deterministic context assembler 雛形
- `agent-intent-resolver.ts` -> deterministic-first resolver 雛形
- `agent-execution-verifier.ts` -> post-execution verifier 雛形
- `lifecycle-aware-agent.ts` -> lifecycle/logging wrapper 雛形

換句話說，Zentropy 不是從零開始，而是已經有一個 product-specific implementation。下一步是把這些接口上提，讓 Zentropy 改為 `naru-agent-system` 的一個組裝實例。

## 14. Example Product Config

```ts
const zentropyConfig: AgentSystemConfig = {
  systemName: "zentropy-line-agent",
  roles: {
    decisionFallback: {
      name: "zentropy-decision",
      instructions: ["..."],
      model: { provider: "openai", model: "gpt-5-mini" },
      outputMode: "structured",
    },
    response: {
      name: "zentropy-response",
      instructions: ["..."],
      model: { provider: "openai", model: "gpt-5-mini" },
      enabledTools: [
        "brain_dump",
        "query_tasks",
        "complete_task",
        "planner",
        "query_calendar",
      ],
      memoryMode: "each_turn",
      outputMode: "free_text",
    },
  },
  protocols: {
    decisionContext: zentropyDecisionContextProtocol,
    conversationState: zentropyConversationStateProtocol,
    toolResult: zentropyToolResultProtocol,
    replyVerification: zentropyReplyVerificationPolicy,
  },
  routing: {
    intentSchema: zentropyIntentSchema,
    deterministicFirst: true,
    classifierFallbackThreshold: 0.72,
    shortInputPolicy: "local_only",
  },
  tools: zentropyToolRegistry,
  policies: {
    confirmation: zentropyConfirmationPolicy,
    truthfulness: zentropyTruthfulnessPolicy,
    memory: zentropyMemoryPolicy,
    lifecycle: zentropyLifecyclePolicy,
  },
  services: {
    safetyKernel: createZentropySafetyKernel(),
    contextAssembler: createZentropyContextAssembler(),
    intentResolver: createZentropyIntentResolver(),
    targetResolver: createZentropyTargetResolver(),
    executor: createZentropyExecutor(),
    verifier: createZentropyVerifier(),
  },
}
```

## 15. Migration Plan

### Phase 1: Normalize interfaces

1. 將現有 `DecisionContext`、`AgentIntent`、tool result、verification result 收斂成明確 contract
2. 移除目前 product code 內隱含的 message parsing 協議

### Phase 2: Extract reusable system package

1. 抽出 shared orchestration interfaces
2. 抽出 shared role factory interfaces
3. 抽出 lifecycle/logging hooks

### Phase 3: Move Zentropy to product config + adapters

1. 讓 Zentropy 只保留 product-specific deterministic services
2. 用 config 裝配 response/decision/memory roles

### Phase 4: Contract tests

1. 為每層介面建立 contract tests
2. 驗證不同產品 config 下，不會破壞 truth boundary

## 16. Risks

### 16.1 False abstraction

若過早把 product-specific logic 全部抽成 generic config，最後會得到難維護的巨大 YAML/JSON，而不是可重用系統。

### 16.2 Prompt-centric illusion

若把 orchestration 問題誤判成 prompt 問題，會讓可用性退化成 demo-level agent。

### 16.3 Protocol drift

若 `DecisionContext`、tool result、reply verifier 沒有 versioned contract，不同產品會產生隱性耦合。

## 17. Success Criteria

以下條件成立，才算模組化成功：

1. 新產品可在不複製 `ToolFirstAgent` 大量邏輯的情況下組裝出 agent system
2. 更換 response prompt 或 decision model，不影響 execution truth
3. mutation claim 仍必須經過 verifier
4. system contract tests 可以攔截 role misconfiguration
5. Zentropy 可作為第一個 product implementation 遷移上去

## 18. Decision

結論不是「把現在的 agent 做成一份 prompt config」。

結論是：

1. `naru_agent` 應上提為 bounded-role runtime core
2. 另建 `naru-agent-system` 作為 multi-layer assembly framework
3. 產品只提供 config + deterministic adapters
4. truth-boundary layers 嚴禁退化為 prompt-only

這樣才有可能快速重現「現在這樣有實用價值的 agent 能力」，而不是重現一個只有表面對話能力的 agent。
