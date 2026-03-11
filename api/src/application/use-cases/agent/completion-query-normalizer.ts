import { normalizeCompletionInputText } from "./completion-query-normalizer/core"
import { normalizeCompletionQueryZhTw } from "./completion-query-normalizer/locale-zh-tw"
import type { StructuredCompletionQueryNormalizer } from "./completion-query-normalizer-agent"
import { getCompletionQueryNormalizerAgent } from "./completion-query-normalizer-agent"

export function normalizeCompletionQuery(text: string): string {
  return normalizeCompletionQueryZhTw(text)
}

const SUSPICIOUS_QUERY_PATTERN = /^(?:剛|剛剛|剛才|我剛|我剛剛|我剛才|今天已經|我已經)|(?:完成|做完|done|搞定|處理完|整理完|跑完|完)$/u
const DEICTIC_ONLY_PATTERN = /^(?:這個|那個|這件事|上一個|上個|剛剛那個|剛才那個)?$/u
const FALLBACK_TRIGGER_PATTERN = /(?:剛|剛剛|剛才|已經|今天已經|我已經|我剛)|[，,]|(?:幫我|請).*(?:完成|done|標記完成|勾掉)/u

export function shouldUseCompletionNormalizationFallback(originalText: string, normalizedQuery: string): boolean {
  const original = normalizeCompletionInputText(originalText)
  const normalized = normalizeCompletionInputText(normalizedQuery)

  if (!original) return false
  if (!normalized || DEICTIC_ONLY_PATTERN.test(normalized)) return false
  if (!/(完成|做完|完了|done|搞定|處理完|標記完成|勾掉|好了)/i.test(original)) return false

  return FALLBACK_TRIGGER_PATTERN.test(original)
    || SUSPICIOUS_QUERY_PATTERN.test(normalized)
    || normalized.length >= original.length - 1
}

function sanitizeFallbackQuery(query: string): string {
  return normalizeCompletionQuery(query)
}

export async function resolveCompletionQuery(
  text: string,
  options?: { fallbackAgent?: Pick<StructuredCompletionQueryNormalizer, "normalize"> | null },
): Promise<string> {
  const deterministic = normalizeCompletionQuery(text)
  if (!shouldUseCompletionNormalizationFallback(text, deterministic)) {
    return deterministic
  }

  const agent = options?.fallbackAgent ?? getCompletionQueryNormalizerAgent()
  if (!agent) return deterministic

  const decision = await agent.normalize(text)
  if (!decision || decision.confidence < 0.7) {
    return deterministic
  }

  const fallback = sanitizeFallbackQuery(decision.query)
  if (!fallback || DEICTIC_ONLY_PATTERN.test(fallback)) {
    return deterministic
  }

  return fallback
}
