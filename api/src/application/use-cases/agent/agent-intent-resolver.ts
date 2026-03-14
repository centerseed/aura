import type { LanguageModel, ModelMessage } from "ai"
import { LLMStructuredClassifier, type DecisionAgentResult, type StructuredClassifier, type DecisionOptions, type BaseIntentResolver, type OrchestratorIntent, type IntentResolveInput } from "@centerseedwu/naru-agent"
import type { AgentDecisionTrace, AgentIntent, AgentIntentObject } from "./agent-intent"
import { AgentIntentSchema } from "./agent-intent"
import { hasExplicitCaptureFrame } from "./explicit-capture-frame"
import { logAgentLlmCall, normalizeAgentUsage } from "./llm-logging"
import { hasCompletionCueZhTw } from "./completion-query-normalizer/locale-zh-tw"
import { isCompletionStatusStatement, isStableCompletionQuery, normalizeCompletionQuery } from "./completion-query-normalizer"
// ── Deterministic Fast-Path Patterns ─────────────────────────────────────────
// 只保留語意 100% 明確、不可能碰撞的 pattern。
// 其餘全部交給 LLM structured classifier。

const SHORT_UNDERSPECIFIED_PATTERN = /^(記|好|嗯|喔|哦|欸|？|\?)$/

const REORGANIZE_PATTERN = /^幫我整理|^整理(一下)?(任務|待辦)/i
const CALENDAR_TASK_LINK_PATTERN = /(?:把|將)?\s*(?:第\s*[一二三四五六七八九十\d]+\s*個|最後一個|最後那個|這個|那個)\s*(?:行程|會議|活動)?\s*(?:加到任務|加成任務|變成任務|建立任務|建成任務)/iu
const ADJUST_CLASSIFICATION_PATTERN = /(?:移到|改到|換到|放到|放在|改放到|改放在|分到|應該在|分類錯|不是.+(?:產品線|分類|topic|product)|從.+移到.+)/iu
const CONTEXTUAL_TASK_REFERENCE_PATTERN = /(?:這個任務|那個任務|這件事|這個|那個|剛剛那個|剛才那個|上一個|上個)/u
const CONTEXTUAL_LIST_REFERENCE_PATTERN = /(?:第\s*[一二三四五六七八九十\d]+\s*個|最後一個|最後那個|這個|那個|剛剛那個|剛才那個|上一個|上個)/u

type TraceSpeechAct = NonNullable<NonNullable<AgentDecisionTrace["metadata"]>["speechAct"]>
type TraceTargetReferenceMode = NonNullable<NonNullable<AgentDecisionTrace["metadata"]>["targetReferenceMode"]>
type TraceTemporalScope = NonNullable<NonNullable<AgentDecisionTrace["metadata"]>["temporalScope"]>

function resolveTemporalScope(message: string): TraceTemporalScope {
  if (/今天/.test(message)) return "today"
  if (/明天|下週|下周|之後|稍後|週五前|周五前|月底前/.test(message)) return "future"
  return "none"
}

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
].join("\n")

function shouldBypassFallbackClassifier(message: string): boolean {
  const trimmed = message.trim()
  return SHORT_UNDERSPECIFIED_PATTERN.test(trimmed) || trimmed.length <= 1
}

export class DeterministicAgentIntentResolver implements AgentIntentResolver {
  resolve(input: ResolveAgentIntentInput): ResolveAgentIntentResult {
    const message = input.message.trim()
    const explicitCaptureFrame = hasExplicitCaptureFrame(message)

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

    if (CALENDAR_TASK_LINK_PATTERN.test(message)) {
      return buildResult({
        object: "calendar_task_link",
        requiresConfirmation: false,
        confidence: 0.97,
        speechAct: "mutate",
        targetReferenceMode: CONTEXTUAL_LIST_REFERENCE_PATTERN.test(message) ? "contextual" : "explicit",
        temporalScope: "future",
        reasonCodes: ["calendar_task_link_fast_path"],
      }, message)
    }

    if (explicitCaptureFrame) {
      return buildResult({
        object: "task_capture",
        requiresConfirmation: false,
        confidence: 0.96,
        speechAct: "mutate",
        targetReferenceMode: "none",
        temporalScope: resolveTemporalScope(message),
        reasonCodes: ["explicit_capture_frame_priority"],
      }, message)
    }

    const isContextualClassificationCorrection = CONTEXTUAL_TASK_REFERENCE_PATTERN.test(message)
      && /(?:放在|放到|改到|移到|換到|改放到|改放在|應該在|不是)/u.test(message)

    if (ADJUST_CLASSIFICATION_PATTERN.test(message) || isContextualClassificationCorrection) {
      return buildResult({
        object: "classification",
        requiresConfirmation: false,
        confidence: 0.93,
        speechAct: "mutate",
        targetReferenceMode: CONTEXTUAL_TASK_REFERENCE_PATTERN.test(message) ? "contextual" : "explicit",
        temporalScope: "none",
        reasonCodes: ["adjust_classification_fast_path"],
      }, message)
    }

    const normalizedCompletionQuery = normalizeCompletionQuery(message)
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
 */
export class IntentResolverAdapter implements BaseIntentResolver<AgentIntentObject> {
  private lastTrace: AgentDecisionTrace | null = null

  constructor(private readonly inner: AgentIntentResolver) {}

  async resolve(input: IntentResolveInput): Promise<OrchestratorIntent<AgentIntentObject>> {
    const result = await this.inner.resolve({
      message: input.message,
      history: input.history as ModelMessage[] | undefined,
    })
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
