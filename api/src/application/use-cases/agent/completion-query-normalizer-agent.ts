import { z } from "zod"
import { LLMStructuredClassifier, type StructuredClassifier } from "@centerseedwu/naru-agent"
import type { LanguageModel } from "ai"
import { getAgentRuntime } from "./agent-runtime"
import { createDecisionFallbackAgent, type AgentRuntimeParts } from "./agent-factories"
import { getAgentChatModel, getAgentSummaryModel } from "@/lib/agent-model"
import { logAgentLlmCall, normalizeAgentUsage } from "./llm-logging"

const COMPLETION_QUERY_NORMALIZER_PROMPT = [
  "You normalize a user's completion statement into a canonical task query.",
  "Return only the task title words needed for matching.",
  "Remove temporal adverbs, pronouns, particles, completion phrases, and helper verbs.",
  "If the user only refers to a deictic target like 'this one is done' and no task words remain, return an empty query.",
  "Preserve the task words the user actually said. Do not invent new details.",
  "Examples:",
  "- '剛把書桌整理完了' -> '書桌整理'",
  "- '我今天已經跑完步了，幫我標記完成' -> '跑步'",
  "- '這個 done 了' -> ''",
].join("\n")

const CompletionQueryNormalizationSchema = z.object({
  query: z.string(),
  confidence: z.number().min(0).max(1),
})

type CompletionQueryNormalization = z.infer<typeof CompletionQueryNormalizationSchema>

interface DecisionAgentLike {
  decide<T>(
    message: string,
    classifier: StructuredClassifier<T>,
    options?: { userId?: string; sessionId?: string },
  ): Promise<{
    decision: T
    usage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
    }
    trace?: {
      classifier?: string
    }
  }>
}

export class StructuredCompletionQueryNormalizer {
  private readonly decisionAgent: DecisionAgentLike
  private readonly classifier: StructuredClassifier<CompletionQueryNormalization>

  constructor(config: {
    decisionAgent: DecisionAgentLike
    model: LanguageModel
    classifier?: StructuredClassifier<CompletionQueryNormalization>
  }) {
    this.decisionAgent = config.decisionAgent
    this.classifier = config.classifier ?? new LLMStructuredClassifier<CompletionQueryNormalization>({
      name: "zentropy-completion-query-normalizer-v1",
      model: config.model,
      schema: CompletionQueryNormalizationSchema,
      systemPrompt: COMPLETION_QUERY_NORMALIZER_PROMPT,
    })
  }

  async normalize(message: string): Promise<CompletionQueryNormalization | null> {
    try {
      const startedAt = Date.now()
      const result = await this.decisionAgent.decide(message, this.classifier)
      logAgentLlmCall({
        event: "agent_llm_call",
        feature: "completion_query_normalizer",
        latencyMs: Date.now() - startedAt,
        usage: normalizeAgentUsage(result.usage),
        model: result.trace?.classifier ?? "unknown",
        metadata: {
          messageLen: message.length,
          normalizedQuery: result.decision.query,
          confidence: result.decision.confidence,
        },
      })
      return result.decision
    } catch (error) {
      console.warn("[completion-query-normalizer-agent] fallback failed:", error)
      return null
    }
  }
}

let cachedNormalizer: StructuredCompletionQueryNormalizer | null = null

function buildRuntime(): AgentRuntimeParts {
  const rawRuntime = getAgentRuntime()
  return {
    sessionStore: rawRuntime.sessionStore,
    summaryStore: rawRuntime.summaryStore,
    memoryManager: null,
    longTermMemoryMode: "disabled",
    chatModel: getAgentChatModel(),
    summaryModel: getAgentSummaryModel(),
    guardrails: undefined,
  }
}

export function getCompletionQueryNormalizerAgent(): StructuredCompletionQueryNormalizer | null {
  if (cachedNormalizer) return cachedNormalizer

  try {
    const runtime = buildRuntime()
    cachedNormalizer = new StructuredCompletionQueryNormalizer({
      decisionAgent: createDecisionFallbackAgent(runtime),
      model: runtime.chatModel,
    })
    return cachedNormalizer
  } catch (error) {
    console.warn("[completion-query-normalizer-agent] disabled:", error)
    return null
  }
}
