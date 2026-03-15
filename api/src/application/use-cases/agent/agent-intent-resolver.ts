import type { LanguageModel, ModelMessage } from "ai"
import { LLMStructuredClassifier, type DecisionAgentResult, type StructuredClassifier, type DecisionOptions, type BaseIntentResolver, type OrchestratorIntent, type IntentResolveInput } from "@centerseedwu/naru-agent"
import type { AgentDecisionTrace, AgentIntent, AgentIntentObject } from "./agent-intent"
import { AgentIntentSchema } from "./agent-intent"
import { logAgentLlmCall, normalizeAgentUsage } from "./llm-logging"
import { hasCompletionCueZhTw } from "./completion-query-normalizer/locale-zh-tw"
import { isCompletionStatusStatement, isStableCompletionQuery, normalizeCompletionQueryText } from "./completion-query-normalizer"
import { resolveOrdinalIndex } from "./intent-router"
import type { LinePendingStateManager } from "./line-adapter"
import type { AgentSessionState } from "./agent-session-state"

function isAgentSessionState(value: unknown): value is AgentSessionState {
  return (
    value !== null
    && typeof value === "object"
    && "lastPresentedEntities" in value
    && Array.isArray((value as AgentSessionState).lastPresentedEntities)
    && "lastRecordedEntities" in value
    && Array.isArray((value as AgentSessionState).lastRecordedEntities)
  )
}
// ── Deterministic Fast-Path Patterns ─────────────────────────────────────────
// 只保留語意 100% 明確、不可能碰撞的 pattern。
// 其餘全部交給 LLM structured classifier。

const SHORT_UNDERSPECIFIED_PATTERN = /^(記|好|嗯|喔|哦|欸|？|\?)$/

// Pattern for the bare 記 short-circuit (FIX-2)
export const SHORT_RECORD_PATTERN = /^記$/

const REORGANIZE_PATTERN = /^幫我整理|^整理(一下)?(任務|待辦)/i

type TraceSpeechAct = NonNullable<NonNullable<AgentDecisionTrace["metadata"]>["speechAct"]>
type TraceTargetReferenceMode = NonNullable<NonNullable<AgentDecisionTrace["metadata"]>["targetReferenceMode"]>
type TraceTemporalScope = NonNullable<NonNullable<AgentDecisionTrace["metadata"]>["temporalScope"]>

export interface ResolveAgentIntentInput {
  message: string
  history?: ModelMessage[]
  sessionId?: string
  userId?: string
}

export interface ResolveAgentIntentResult {
  intent: AgentIntent
  trace: AgentDecisionTrace
}

export interface AgentIntentResolver {
  resolve(input: ResolveAgentIntentInput): Promise<ResolveAgentIntentResult> | ResolveAgentIntentResult
}

function buildResult(
  input: {
    object: AgentIntent["object"]
    requiresConfirmation: boolean
    confidence: number
    speechAct: TraceSpeechAct
    targetReferenceMode: TraceTargetReferenceMode
    temporalScope: TraceTemporalScope
    reasonCodes: string[]
  },
  message: string,
): ResolveAgentIntentResult {
  const intent: AgentIntent = {
    object: input.object,
    requiresConfirmation: input.requiresConfirmation,
    confidence: input.confidence,
  }

  return {
    intent,
    trace: {
      routeSource: "intent_resolver",
      resolver: "deterministic-v1",
      rawMessage: message,
      resolvedIntent: intent,
      metadata: {
        speechAct: input.speechAct,
        targetReferenceMode: input.targetReferenceMode,
        temporalScope: input.temporalScope,
        reasonCodes: input.reasonCodes,
      },
      selectedTool: null,
      targetQuery: null,
    },
  }
}

export interface DecisionAgentLike {
  decide<T>(
    message: string,
    classifier: StructuredClassifier<T>,
    options?: DecisionOptions,
  ): Promise<DecisionAgentResult<T>>
}

const STRUCTURED_INTENT_SYSTEM_PROMPT = [
  "You are the decision layer for Zentropy's LINE task agent.",
  "Return a structured intent that matches the provided schema.",
  "Return only the minimal canonical intent fields: object, requiresConfirmation, confidence.",
  "Use conversation summary and memory only as supporting context.",
  "Do not invent targets or actions that are not grounded in the message/context.",
  "If intent is unclear, return object='unknown', requiresConfirmation=false, confidence below 0.5.",
  "Examples:",
  "- '把第二個行程加到任務' -> calendar_task_link",
  "- '移到產品A' -> classification",
  "- '幫我把跑步標記完成' -> task_completion",
  "- '幫我記了什麼' -> recall_last_item (NOT task_capture)",
].join("\n")

function shouldBypassFallbackClassifier(message: string): boolean {
  const trimmed = message.trim()
  return SHORT_UNDERSPECIFIED_PATTERN.test(trimmed) || trimmed.length <= 1
}

// Fast-path keyword sets for task_capture
const TASK_CAPTURE_PREFIXES = ["記錄", "幫我記", "新增任務"]
const INTERROGATIVE_SUFFIX = /(?:什麼|哪個|哪一個|哪件|哪件事|了什麼|的是什麼|\?|？)$/u

function isTaskCaptureFastPath(message: string): boolean {
  if (INTERROGATIVE_SUFFIX.test(message)) return false
  return TASK_CAPTURE_PREFIXES.some((prefix) => message.startsWith(prefix))
}

// Fast-path keywords for task_completion
const TASK_COMPLETION_KEYWORDS = ["完成", "done", "做完"]

function isTaskCompletionFastPath(message: string): boolean {
  return TASK_COMPLETION_KEYWORDS.some((keyword) => message.includes(keyword))
}

export class DeterministicAgentIntentResolver implements AgentIntentResolver {
  resolve(input: ResolveAgentIntentInput): ResolveAgentIntentResult {
    const message = input.message.trim()

    // ── Fast-path: 只攔截語意 100% 明確的 pattern ──

    if (REORGANIZE_PATTERN.test(message)) {
      return buildResult({
        object: "reorganize",
        requiresConfirmation: false,
        confidence: 0.97,
        speechAct: "mutate",
        targetReferenceMode: "none",
        temporalScope: "none",
        reasonCodes: ["fast_path_reorganize"],
      }, message)
    }

    // task_capture fast-path: 3 prefix keywords
    if (isTaskCaptureFastPath(message)) {
      return buildResult({
        object: "task_capture",
        requiresConfirmation: false,
        confidence: 0.96,
        speechAct: "mutate",
        targetReferenceMode: "none",
        temporalScope: "none",
        reasonCodes: ["explicit_capture_frame_priority"],
      }, message)
    }

    const normalizedCompletionQuery = normalizeCompletionQueryText(message)
    if (isCompletionStatusStatement(message) && isStableCompletionQuery(normalizedCompletionQuery)) {
      return buildResult({
        object: "task_completion",
        requiresConfirmation: true,
        confidence: 0.9,
        speechAct: "mutate",
        targetReferenceMode: "explicit",
        temporalScope: "none",
        reasonCodes: ["completion_status_statement_fast_path"],
      }, message)
    }

    // ── 其餘全部交給 LLM classifier ──

    return buildResult({
      object: "unknown",
      requiresConfirmation: false,
      confidence: 0.1,
      speechAct: "meta",
      targetReferenceMode: "none",
      temporalScope: "none",
      reasonCodes: [
        hasCompletionCueZhTw(message)
          ? "completion_cue_requires_classifier"
          : "no_direct_route_match",
      ],
    }, message)
  }
}

export class StructuredFallbackAgentIntentResolver implements AgentIntentResolver {
  private readonly deterministicResolver: AgentIntentResolver

  private readonly classifier: StructuredClassifier<AgentIntent>

  constructor(config: {
    decisionAgent: DecisionAgentLike
    model: LanguageModel
    deterministicResolver?: AgentIntentResolver
    classifier?: StructuredClassifier<AgentIntent>
  }) {
    this.decisionAgent = config.decisionAgent
    this.deterministicResolver = config.deterministicResolver ?? new DeterministicAgentIntentResolver()
    this.classifier = config.classifier ?? new LLMStructuredClassifier<AgentIntent>({
      name: "zentropy-agent-intent-v1",
      model: config.model,
      schema: AgentIntentSchema,
      systemPrompt: STRUCTURED_INTENT_SYSTEM_PROMPT,
    })
  }

  private readonly decisionAgent: DecisionAgentLike

  async resolve(input: ResolveAgentIntentInput): Promise<ResolveAgentIntentResult> {
    const deterministicResult = await this.deterministicResolver.resolve(input)
    if (deterministicResult.intent.object !== "unknown") {
      return deterministicResult
    }

    if (shouldBypassFallbackClassifier(input.message)) {
      return deterministicResult
    }

    let decision
    const classifierStartedAt = Date.now()
    try {
      decision = await this.decisionAgent.decide(input.message, this.classifier, {
        userId: input.userId,
        sessionId: input.sessionId,
      })
    } catch (err) {
      console.warn("[intent-resolver] classifier failed, falling back to deterministic result:", err)
      return deterministicResult
    }

    const intent: AgentIntent = decision.decision
    const classifierLatencyMs = Date.now() - classifierStartedAt
    const classifierUsage = normalizeAgentUsage(decision.usage)

    logAgentLlmCall({
      event: "agent_llm_call",
      feature: "intent_classifier",
      userId: input.userId,
      sessionId: input.sessionId,
      model: decision.trace?.classifier ?? "unknown",
      latencyMs: classifierLatencyMs,
      usage: classifierUsage,
      metadata: {
        intentObject: intent.object,
        resolver: decision.trace?.classifier ?? "unknown",
        messageLen: input.message.length,
      },
    })

    return {
      intent,
      trace: {
        routeSource: "intent_resolver",
        resolver: `naru-structured-v0.1.2:${decision.trace?.classifier ?? "unknown"}`,
        rawMessage: input.message,
        resolvedIntent: intent,
        metadata: {
          reasonCodes: ["structured_classifier_fallback"],
          classifierUsage,
          classifierLatencyMs,
        },
        selectedTool: null,
        targetQuery: null,
      },
    }
  }
}

/**
 * IntentResolverAdapter — bridges AgentIntentResolver → BaseIntentResolver<AgentIntentObject>
 *
 * The new AgentOrchestrator expects a BaseIntentResolver that returns OrchestratorIntent.
 * Our existing AgentIntentResolver returns { intent, trace } (ResolveAgentIntentResult).
 *
 * This adapter wraps AgentIntentResolver and:
 * - Maps AgentIntent → OrchestratorIntent<AgentIntentObject>
 * - Stores the full AgentDecisionTrace for later retrieval by DirectExecutorAdapter
 * - FIX-1: Short-circuits to "pending_confirmation" when pending state exists (avoids LLM call)
 * - FIX-2: Short-circuits to "short_record" for bare 記 messages
 * - FIX-4: Applies ordinal override logic (unknown + ordinal + lastPresentedEntities → task_completion)
 */
export class IntentResolverAdapter implements BaseIntentResolver<AgentIntentObject> {
  private lastTrace: AgentDecisionTrace | null = null

  constructor(
    private readonly inner: AgentIntentResolver,
    private readonly pendingStateManager?: LinePendingStateManager,
  ) {}

  async resolve(input: IntentResolveInput): Promise<OrchestratorIntent<AgentIntentObject>> {
    const message = input.message.trim()

    // FIX-1: If pending state exists, short-circuit before any LLM classifier call.
    // PendingConfirmationExecutor (Phase 2) will handle the actual execution.
    if (this.pendingStateManager) {
      const pending = await this.pendingStateManager.getPending("")
      if (pending) {
        this.lastTrace = {
          routeSource: "intent_resolver",
          resolver: "pending-state-fast-path",
          rawMessage: message,
          resolvedIntent: { object: "pending_confirmation", requiresConfirmation: false, confidence: 1.0 },
          metadata: { reasonCodes: ["pending_state_fast_path"] },
          selectedTool: null,
          targetQuery: null,
        }
        return { object: "pending_confirmation", confidence: 1.0, requiresConfirmation: false }
      }
    }

    // FIX-2: 記 short-circuit — return "short_record" intent, handled by DirectExecutorAdapter
    if (SHORT_RECORD_PATTERN.test(message)) {
      this.lastTrace = {
        routeSource: "intent_resolver",
        resolver: "short-record-fast-path",
        rawMessage: message,
        resolvedIntent: { object: "short_record", requiresConfirmation: false, confidence: 1.0 },
        metadata: { reasonCodes: ["short_record_fast_path"] },
        selectedTool: null,
        targetQuery: null,
      }
      return { object: "short_record", confidence: 1.0, requiresConfirmation: false }
    }

    const result = await this.inner.resolve({
      message: input.message,
      history: input.history as ModelMessage[] | undefined,
    })

    // FIX-4: Ordinal override — if intent is unknown but message has ordinal + session has
    // lastPresentedEntities, override to task_completion (restores IntentRouter behaviour).
    // Our domain AgentSessionState is tunnelled through sessionState.metadata by the orchestrator.
    if (result.intent.object === "unknown") {
      const rawMetadata = (input.sessionState as { metadata?: unknown } | null)?.metadata
      const sessionState = isAgentSessionState(rawMetadata) ? rawMetadata : null
      const hasOrdinal = resolveOrdinalIndex(message) !== null
      const hasRecentList = (sessionState?.lastPresentedEntities.length ?? 0) > 0
      if (hasOrdinal && hasRecentList) {
        const overriddenIntent: AgentIntent = {
          ...result.intent,
          object: "task_completion" as const,
          requiresConfirmation: true,
          confidence: 0.9,
        }
        this.lastTrace = {
          ...result.trace,
          resolvedIntent: overriddenIntent,
          metadata: {
            ...result.trace.metadata,
            reasonCodes: [...(result.trace.metadata?.reasonCodes ?? []), "ordinal_override_task_completion"],
          },
        }
        return {
          object: "task_completion",
          confidence: 0.9,
          requiresConfirmation: true,
        }
      }
    }

    this.lastTrace = result.trace
    return {
      object: result.intent.object,
      confidence: result.intent.confidence,
      requiresConfirmation: result.intent.requiresConfirmation,
    }
  }

  /** Returns the AgentDecisionTrace from the most recent resolve() call. */
  getLastTrace(): AgentDecisionTrace | null {
    return this.lastTrace
  }
}
