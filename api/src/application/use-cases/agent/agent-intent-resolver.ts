import type { LanguageModel, ModelMessage } from "ai"
import { LLMStructuredClassifier, type DecisionAgentResult, type StructuredClassifier, type DecisionOptions } from "naru-agent-js"
import type { AgentDecisionTrace, AgentIntent } from "./agent-intent"
import { AgentIntentSchema } from "./agent-intent"
// ── Deterministic Fast-Path Patterns ─────────────────────────────────────────
// 只保留語意 100% 明確、不可能碰撞的 pattern。
// 其餘全部交給 LLM structured classifier。

// — 排除清單：這些看似像 brain dump 但其實是查詢/meta —
const NON_CAPTURE_PATTERNS: RegExp[] = [
  /今天.*(有哪些|有什麼|要做什麼|任務|待辦|代辦)/i,
  /(有哪些|有什麼).*(任務|待辦|代辦)/i,
  /(我剛才|我剛剛).*(說了什麼|問了什麼|記了什麼)/i,
  /(你是誰|你可以做什麼|可以做什麼)/i,
  /(完成了什麼|做了什麼)/i,
  /(查詢|列出|顯示).*(任務|待辦|代辦)/i,
  /(還剩什麼|剩下什麼)/i,
]

// — 明確記錄意圖（brain dump / task capture）—
const EXPLICIT_CAPTURE_PATTERNS: RegExp[] = [
  /(記錄|記下|記一下|幫我記|幫我加|新增任務|待辦|todo)/i,
  /(再加一個|補一個|另外一個)/i,
]

const GREETING_PATTERN = /^(?:你好|嗨|hi|hello|hey)$|你是誰|可以做什麼/i
const RECALL_LAST_ITEM_PATTERN = /我剛才記了什麼/i
const RECALL_TASK_CODE_PATTERN = /任務代號是什麼|只回答代號/i
const SHORT_UNDERSPECIFIED_PATTERN = /^(記|好|嗯|喔|哦|欸|？|\?)$/

// — 制式回應引導的 fast-path（用戶照著提示說的話，必須穩定接住）—
const TODAY_FOCUS_PATTERN = /^今天(要做什麼|有什麼|有哪些)|(今天|明天).*(待辦|代辦|任務|要做|待辦事項|代辦事項)/i
const COMPLETED_TODAY_PATTERN = /今天.*(?:完成了什麼|做了什麼|完成哪些|做了哪些|已完成(?:什麼|哪些)?)|(?:完成了什麼|做了什麼|已完成哪些)/i
const COMPLETE_TASK_PATTERN = /完成|做完|跑完|弄完|處理完|搞定|done|完成了|已完成|做好了|結束了|標記(?:成|為)?完成|勾掉/i
const CONTEXTUAL_COMPLETE_PATTERN_INTENT = /這件事|這個|那個|剛剛那個|剛才那個|上一個|上個/i
const MUTATION_REQUEST_PATTERN = /幫我|請|把|將|麻煩|標記|勾掉|設成|改成/i
const QUERY_WORD_PATTERN = /嗎|？|\?|請問|查詢|列出|顯示|哪些|什麼|多少|還剩|剩下/i
const REORGANIZE_PATTERN = /^幫我整理|^整理(一下)?(任務|待辦)/i
const PLANNING_PATTERN = /^幫我(規劃|拆解)|^(規劃|拆解)(一下)?[^？?]*$/i

function hasExplicitCaptureFrame(message: string): boolean {
  if (!message) return false
  if (NON_CAPTURE_PATTERNS.some((p) => p.test(message))) return false
  return EXPLICIT_CAPTURE_PATTERNS.some((p) => p.test(message))
}

function resolveTemporalScope(message: string): AgentIntent["temporalScope"] {
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

function buildIntent(intent: AgentIntent, message: string): ResolveAgentIntentResult {
  return {
    intent,
    trace: {
      routeSource: "intent_resolver",
      resolver: "deterministic-v1",
      rawMessage: message,
      resolvedIntent: intent,
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
  "Classify the user's immediate speech act and object.",
  "Use conversation summary and memory only as supporting context.",
  "Do not invent targets or actions that are not grounded in the message/context.",
  "If intent is unclear, return object='unknown', targetReferenceMode='none', requiresConfirmation=false, confidence below 0.5.",
  "reasonCodes must be short machine-readable strings.",
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

    if (GREETING_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "meta",
        object: "greeting",
        targetReferenceMode: "none",
        temporalScope: "none",
        requiresConfirmation: false,
        confidence: 0.99,
        reasonCodes: ["meta_greeting"],
      }, message)
    }

    if (TODAY_FOCUS_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "query",
        object: "today_focus",
        targetReferenceMode: "none",
        temporalScope: "today",
        requiresConfirmation: false,
        confidence: 0.98,
        reasonCodes: ["fast_path_today_focus"],
      }, message)
    }

    if (COMPLETED_TODAY_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "query",
        object: "completed_today",
        targetReferenceMode: "none",
        temporalScope: "today",
        requiresConfirmation: false,
        confidence: 0.98,
        reasonCodes: ["fast_path_completed_today"],
      }, message)
    }

    if (REORGANIZE_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "mutate",
        object: "reorganize",
        targetReferenceMode: "none",
        temporalScope: "none",
        requiresConfirmation: false,
        confidence: 0.97,
        reasonCodes: ["fast_path_reorganize"],
      }, message)
    }

    if (PLANNING_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "mutate",
        object: "planning",
        targetReferenceMode: "contextual",
        temporalScope: "none",
        requiresConfirmation: false,
        confidence: 0.97,
        reasonCodes: ["fast_path_planning"],
      }, message)
    }

    if (RECALL_TASK_CODE_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "query",
        object: "recall_task_code",
        targetReferenceMode: "none",
        temporalScope: "none",
        requiresConfirmation: false,
        confidence: 0.99,
        reasonCodes: ["meta_recall_task_code"],
      }, message)
    }

    if (RECALL_LAST_ITEM_PATTERN.test(message)) {
      return buildIntent({
        speechAct: "query",
        object: "recall_last_item",
        targetReferenceMode: "none",
        temporalScope: "past",
        requiresConfirmation: false,
        confidence: 0.99,
        reasonCodes: ["meta_recall_last_item"],
      }, message)
    }

    if (explicitCaptureFrame) {
      return buildIntent({
        speechAct: "mutate",
        object: "task_capture",
        targetReferenceMode: "none",
        temporalScope: resolveTemporalScope(message),
        requiresConfirmation: false,
        confidence: 0.96,
        reasonCodes: ["explicit_capture_frame_priority"],
      }, message)
    }

    if (COMPLETE_TASK_PATTERN.test(message)) {
      const contextualReference = CONTEXTUAL_COMPLETE_PATTERN_INTENT.test(message)
      const mutationRequest = MUTATION_REQUEST_PATTERN.test(message)
      const queryWord = QUERY_WORD_PATTERN.test(message)

      if (contextualReference || mutationRequest || !queryWord) {
        return buildIntent({
          speechAct: "mutate",
          object: "task_completion",
          targetReferenceMode: contextualReference ? "contextual" : "explicit",
          temporalScope: /今天/.test(message) ? "today" : "none",
          requiresConfirmation: true,
          confidence: contextualReference || mutationRequest ? 0.94 : 0.82,
          reasonCodes: [
            contextualReference ? "contextual_completion_reference" : "explicit_completion_reference",
            mutationRequest ? "completion_mutation_request" : "completion_statement",
          ],
        }, message)
      }
    }

    // ── 其餘全部交給 LLM classifier ──

    return buildIntent({
      speechAct: "meta",
      object: "unknown",
      targetReferenceMode: "none",
      temporalScope: "none",
      requiresConfirmation: false,
      confidence: 0.1,
      reasonCodes: ["no_direct_route_match"],
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
    try {
      decision = await this.decisionAgent.decide(input.message, this.classifier, {
        userId: input.userId,
        sessionId: input.sessionId,
      })
    } catch (err) {
      console.warn("[intent-resolver] classifier failed, falling back to deterministic result:", err)
      return deterministicResult
    }

    const reasonCodes = decision.decision.reasonCodes.length > 0
      ? decision.decision.reasonCodes
      : ["structured_classifier_fallback"]
    const intent: AgentIntent = {
      ...decision.decision,
      reasonCodes,
    }

    return {
      intent,
      trace: {
        routeSource: "intent_resolver",
        resolver: `naru-structured-v0.1.2:${decision.trace?.classifier ?? "unknown"}`,
        rawMessage: input.message,
        resolvedIntent: intent,
        selectedTool: null,
        targetQuery: null,
      },
    }
  }
}
