import type { AiTokenUsage } from "@/lib/ai-rate-limit"

export interface NormalizedLlmUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export function normalizeAgentUsage(usage?: {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
} | null): NormalizedLlmUsage {
  const inputTokens = usage?.promptTokens ?? 0
  const outputTokens = usage?.completionTokens ?? 0
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens
  return { inputTokens, outputTokens, totalTokens }
}

export function normalizeAiSdkUsage(usage?: AiTokenUsage | null): NormalizedLlmUsage {
  const inputTokens = usage?.inputTokens ?? 0
  const outputTokens = usage?.outputTokens ?? 0
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
}

export function logAgentLlmCall(input: {
  event: string
  feature: string
  latencyMs: number
  usage?: NormalizedLlmUsage | null
  userId?: string | null
  sessionId?: string | null
  model?: string | null
  metadata?: Record<string, unknown>
}): void {
  console.log(JSON.stringify({
    event: input.event,
    feature: input.feature,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    model: input.model ?? null,
    latency_ms: input.latencyMs,
    usage: input.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ...input.metadata,
  }))
}
