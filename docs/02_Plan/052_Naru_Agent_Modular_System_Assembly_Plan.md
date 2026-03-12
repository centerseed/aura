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
6. 讓 Python 與 JS/TS 共享同一套 assembly contract，而不是各自長出相似但不相容的 runtime
7. 把 Zentropy 已驗證過的 deterministic orchestration 經驗沉澱成 reusable adapter pattern，而不是只存在於單一專案內

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

### 5.5 Polyglot parity over feature cloning

Python 與 JS 不需要逐行對齊實作，但必須共享：

- 相同的 config semantics
- 相同的 protocol schema
- 相同的 deterministic boundary vocabulary
- 相同的 contract test expectations

也就是說，跨語言要追求的是 parity，不是 copy-paste。

## 6. Current State Assessment

先釐清現況，避免抽象方向失焦。

### 6.1 `naru_agent` 已經具備的基礎

`naru_agent` 與 `naru-agent-js` 其實都已經有 reusable runtime 雛形：

- `NaruAgent` runtime
- tools / skills registry
- memory manager
- session store
- context compression / summary store
- guardrails
- structured classifier / decision helper
- tracing / event bus

這代表「單 agent runtime」不是主要缺口。

### 6.2 真正綁死在 Zentropy 專案內的能力

Zentropy 真正有價值、但目前尚未 productize 的，是這些 deterministic system layer：

- `agent-context-assembler.ts`
- `agent-intent-resolver.ts`
- `tool-first-agent.ts`
- `agent-execution-verifier.ts`
- `lifecycle-aware-agent.ts`
- session-based confirmation / contextual reference / tool result protocol

換句話說，現在缺的不是再做一個更大的 `NaruAgent`，而是把這些系統邊界抽成可組裝框架。

### 6.3 目前 Python / JS 的落差

現況不是「Python 先進、JS 落後」，而是兩邊都只做到 runtime layer，system layer 仍未正式抽象。

主要落差如下：

1. JS 版已較明確支援 `StructuredClassifier` / `DecisionAgentResult` 與 tool planning
2. Python 版仍混有 legacy `Agent` 與 Agno-based `NaruAgent` 雙路徑
3. 兩邊都沒有 versioned shared protocol package
4. Zentropy 的 deterministic orchestration 目前只存在於 Naruvia app code，尚未回流成通用套件

## 7. Proposed Module Architecture

目標架構應從三層擴成四層：

### 7.1 Layer 0: `naru-agent-contracts`

責任：

- cross-language canonical schemas
- config schema
- protocol schema
- trace / verifier / tool result schema
- contract versioning
- JSON Schema / Zod / Pydantic generation source

這一層不執行 agent，只負責定義跨語言共同語義。

建議內容：

```ts
contracts/
  agent-system-config.schema.json
  decision-context.schema.json
  canonical-intent.schema.json
  tool-execution-result.schema.json
  conversation-state.schema.json
  reply-verification.schema.json
```

Python 與 JS 都從這一層產生型別或驗證器，而不是各自手寫一份近似介面。

### 7.2 Layer A: `naru-agent-core`

責任：

- single-agent runtime
- model adapter
- session store / summary store wiring
- memory manager wiring
- guardrail wiring
- structured classifier adapter
- role-scoped agent factory base

這一層不理解產品 intent，也不決定工具 truth。

### 7.3 Layer B: `naru-agent-system`

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

### 7.4 Layer C: product package

責任：

- product intents
- prompts
- tool definitions
- policy thresholds
- channel adapters
- product-specific deterministic resolvers/executors/verifiers

Zentropy 應落在這一層。

### 7.5 Layer D: channel package

責任：

- LINE / Web / API / CLI channel wording
- confirmation UX adapter
- session key policy
- channel-specific formatting constraints

這層應與 product package 分開，避免把 LINE 特性誤抽象成產品規則。

## 8. Polyglot Expansion Strategy

若要讓 Python 和 JS 都能應用在 Zentropy 的經驗，建議不是做「JS 版複製 Python 架構」或反過來，而是採用下列拆法。

### 8.1 共享 contract，不共享 implementation

共享：

- `AgentSystemConfig`
- `DecisionContext`
- `CanonicalIntent`
- `ToolExecutionResult`
- `ConversationState`
- `VerificationResult`
- tracing event names / shape

不強迫共享：

- underlying LLM SDK
- storage implementation
- web framework / transport
- async model

### 8.2 Core API 維持語言原生

Python：

- 保留 `NaruAgent(...)`
- 補上 `NaruRoleRuntime` 或 `RoleAgentFactory`
- 用 Pydantic 驗證 config / protocol

JS/TS：

- 保留 `new NaruAgent({...})`
- 補上 `createRoleRuntime(config, deps)`
- 用 Zod 或 JSON Schema 驗證 config / protocol

### 8.3 System API 對齊

兩個語言的 system assembly API 應對齊到同一層級：

```ts
interface AgentSystemFactory {
  create(config: AgentSystemConfig, deps: RuntimeDeps): AgentSystem
}
```

```py
class AgentSystemFactory(Protocol):
    def create(self, config: AgentSystemConfig, deps: RuntimeDeps) -> AgentSystem: ...
```

目標是「概念對齊、型別對齊、測試對齊」，不是語法完全一致。

## 9. Target Runtime Layers

### 9.1 Deterministic layers

必須由 system assembly 明確保留以下抽象介面：

1. `SafetyKernel`
2. `ContextAssembler`
3. `IntentResolver`
4. `TargetResolver`
5. `Executor`
6. `PostExecutionVerifier`

此外建議補上兩個明確介面：

7. `ConversationStateStore`
8. `ConfirmationPolicy`

### 9.2 Agent layers

可由 `naru_agent` 實裝以下角色：

1. `DecisionFallbackAgent`
2. `ResponseAgent`
3. `MemoryAwareAssistant`

### 9.3 Optional role

`LowRiskOrchestrator` 可存在，但只能處理低風險 query / clarification，不得直接跨過 deterministic truth boundary。

## 10. Core Contracts

### 10.1 Agent system config

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

### 10.2 Role config

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

### 10.3 Decision context

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

### 10.4 Tool result protocol

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

### 10.5 Product adapter contract

這是目前文件尚缺、但對跨專案重用最重要的一層。

```ts
type ProductAgentAdapter = {
  productName: string
  intents: CanonicalIntentDefinition[]
  tools: ToolRegistration[]
  policies: ProductPolicySet
  createSafetyKernel(deps: ProductDeps): SafetyKernel
  createContextAssembler(deps: ProductDeps): ContextAssembler
  createIntentResolver(deps: ProductDeps): IntentResolver
  createTargetResolver(deps: ProductDeps): TargetResolver
  createExecutor(deps: ProductDeps): Executor
  createVerifier(deps: ProductDeps): PostExecutionVerifier
}
```

這樣 `naru-agent-system` 就只知道如何組裝，不需要理解 Zentropy 的 task / calendar / confirmation 細節。

### 10.6 Channel adapter contract

```ts
type ChannelAdapter = {
  channelName: "line" | "web" | "api" | "cli"
  sessionKeyOf(input: ChatInput): string
  formatReply(reply: VerifiedReply): ChannelReply
  buildConfirmationPrompt(input: ConfirmationPromptInput): string
  parseChannelMetadata(input: ChatInput): ChannelContext
}
```

這可以把目前 `LINE` 專屬的語氣、 confirmation key、回覆格式，從產品邏輯中拆出去。

## 11. Assembly Flow

### 11.1 System boot sequence

1. load `AgentSystemConfig`
2. initialize shared runtime dependencies
3. create deterministic services
4. create role-bounded agents from role configs
5. build orchestrator pipeline
6. expose product-facing `chat()` entry

### 11.2 Message handling pipeline

1. `SafetyKernel.inspect(rawMessage, sessionState)`
2. 若可 direct route，直接進 deterministic path
3. `ContextAssembler.assemble(...)`
4. `IntentResolver.resolve(message, context)`
5. `TargetResolver.resolve(intent, context)`
6. `Executor.execute(request)`
7. `ResponseAgent.respond(result)`
8. `PostExecutionVerifier.verify(reply, result, trace)`
9. persist state, trace, turn log

### 11.3 Fallback rules

LLM fallback 只能出現在以下位置：

1. deterministic intent resolver 無法安全判斷時
2. response formatting 需要自然語言表達時
3. memory-aware low-risk assistance 時

不得出現在以下位置：

1. 是否應產生 side effect
2. target ambiguity 是否可猜測
3. 是否真的執行成功

## 12. Factory Design

### 12.1 Core factory

提供一個 assembly-level factory：

```ts
interface AgentSystemFactory {
  create(config: AgentSystemConfig): AgentSystem
}
```

### 12.2 Internal factories

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

### 12.3 Product assembly output

```ts
type AgentSystem = {
  chat(input: ChatInput): Promise<ChatOutput>
  inspect(): AgentSystemInspection
}
```

## 13. What Zentropy Teaches That Should Become Framework Rules

Zentropy 目前已經驗證了幾個值得上提成 framework 規則的經驗，這些不是單一產品偶然需求。

### 13.1 Query / mutation / preview / clarification 要有明確結果型別

這已經在 `tool-result-protocol.ts` 出現雛形。應正式上提為 framework rule，而不是留在單一產品自行約定。

### 13.2 Cross-turn reference resolution 必須是 deterministic facility

像「上一個」「第二個」「剛才那個」這些能力，在任務、檔案、CRM、ticket 系統都會重複出現。

建議抽成 reusable resolver primitives：

- ordinal reference resolver
- contextual last-mentioned resolver
- pending confirmation resolver
- presented entity registry

### 13.3 Execution claim verification 必須是標配

目前 `agent-execution-verifier.ts` 是 Zentropy 很有價值的 safety pattern，應變成 system default，而不是產品自行決定要不要做。

### 13.4 Lifecycle hooks 與 turn logging 應是 assembly 內建能力

`LifecycleAwareAgent` 不只是 wrapper，而是產品級 agent system 的標準配備：

- before message
- after message
- idle flush
- turn logging
- verification failure logging

這些應進 `naru-agent-system`，不是留在 app project 四散存在。

## 14. What Should Be Configurable

以下應可用設定檔控制：

1. role prompt 與 model
2. tool enablement
3. memory mode
4. guardrail enablement
5. classifier threshold
6. channel-specific wording policy
7. logging / tracing level
8. reply formatting style

## 15. What Must Remain Code

以下必須保留程式實作：

1. safety kernel 規則本體
2. target resolution 邏輯
3. tool execution 與 use case binding
4. execution proof 產生與驗證
5. high-risk confirmation state machine
6. cross-turn reference resolution

補充：雖然 cross-turn reference resolution 可以有 reusable primitives，但產品如何判斷可接受的 target ambiguity，仍應保留程式實作。

## 16. Zentropy Mapping

Zentropy 現有結構可映射如下：

- `agent-factories.ts` -> role agent factory 雛形
- `tool-first-agent.ts` -> orchestration pipeline 雛形
- `agent-context-assembler.ts` -> deterministic context assembler 雛形
- `agent-intent-resolver.ts` -> deterministic-first resolver 雛形
- `agent-execution-verifier.ts` -> post-execution verifier 雛形
- `lifecycle-aware-agent.ts` -> lifecycle/logging wrapper 雛形

換句話說，Zentropy 不是從零開始，而是已經有一個 product-specific implementation。下一步是把這些接口上提，讓 Zentropy 改為 `naru-agent-system` 的一個組裝實例。

## 17. Recommended Package Layout

為了讓其他專案更容易採用，建議最終 package layout 不要只是一個 repo 裡放 Python 和 JS，而是明確分成：

1. `naru-agent-contracts`
2. `naru-agent-core-py`
3. `naru-agent-core-js`
4. `naru-agent-system-py`
5. `naru-agent-system-js`
6. `naru-agent-adapter-zentropy`
7. 其他產品 adapter，例如 `naru-agent-adapter-supportdesk`

若維持 monorepo，也應至少在目錄與發版邏輯上呈現這個分層。

## 18. Example Product Config

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

## 19. Migration Plan

### Phase 1: Extract contracts first

1. 將 `DecisionContext`、`AgentIntent`、tool result、verification result 定義到 shared schema
2. 為 Python / JS 生成型別與 validator
3. 加入 contract version，例如 `v1alpha1`

### Phase 2: Normalize Zentropy adapters

1. 把 `agent-context-assembler.ts`、`agent-intent-resolver.ts`、`agent-execution-verifier.ts` 收斂成 adapter interfaces
2. 移除目前 product code 內隱含的 message parsing 協議
3. 把 LINE-specific session/confirmation policy 從 product logic 拆到 channel adapter

### Phase 3: Extract reusable system package

1. 抽出 shared orchestration interfaces
2. 抽出 shared role factory interfaces
3. 抽出 lifecycle/logging hooks

### Phase 4: Align Python / JS system API

1. JS 先實作 `AgentSystemFactory`
2. Python 補上對應 factory 與 contracts validator
3. 讓兩邊通過同一份 contract test fixtures

### Phase 5: Move Zentropy to product config + adapters

1. 讓 Zentropy 只保留 product-specific deterministic services
2. 用 config 裝配 response/decision/memory roles
3. 確認 `tool-first-agent` 大部分邏輯回流到 system package

### Phase 6: Contract tests

1. 為每層介面建立 contract tests
2. 驗證不同產品 config 下，不會破壞 truth boundary
3. 使用同一批 fixtures 驗證 Python / JS parity

## 20. Risks

### 20.1 False abstraction

若過早把 product-specific logic 全部抽成 generic config，最後會得到難維護的巨大 YAML/JSON，而不是可重用系統。

### 20.2 Prompt-centric illusion

若把 orchestration 問題誤判成 prompt 問題，會讓可用性退化成 demo-level agent。

### 20.3 Protocol drift

若 `DecisionContext`、tool result、reply verifier 沒有 versioned contract，不同產品會產生隱性耦合。

### 20.4 Cross-language skew

若 Python 與 JS 沒有共享 schema 與 fixtures，很快就會長成兩套名字相似但語義不同的系統。

## 21. Success Criteria

以下條件成立，才算模組化成功：

1. 新產品可在不複製 `ToolFirstAgent` 大量邏輯的情況下組裝出 agent system
2. 更換 response prompt 或 decision model，不影響 execution truth
3. mutation claim 仍必須經過 verifier
4. system contract tests 可以攔截 role misconfiguration
5. Zentropy 可作為第一個 product implementation 遷移上去
6. Python / JS 可用同一份 contract fixtures 驗證相同行為語義
7. channel 切換（LINE -> API/Web）不需要重寫 product deterministic services

## 22. Decision

結論不是「把現在的 agent 做成一份 prompt config」。

結論是：

1. `naru_agent` / `naru-agent-js` 應各自保留為 bounded-role runtime core
2. 先建立 `naru-agent-contracts`，再建立 `naru-agent-system`
3. Zentropy 的經驗應沉澱為 reusable deterministic adapters 與 framework defaults
4. 產品只提供 config + deterministic adapters + channel adapters
5. truth-boundary layers 嚴禁退化為 prompt-only

這樣才有可能快速重現「現在這樣有實用價值的 agent 能力」，而不是重現一個只有表面對話能力的 agent。
