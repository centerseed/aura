import { normalizeCompletionInputText } from "./completion-query-normalizer/core"
import { isCompletionStatusStatementZhTw } from "./completion-query-normalizer/locale-zh-tw"
import type { StructuredCompletionQueryNormalizer } from "./completion-query-normalizer-agent"
import { getCompletionQueryNormalizerAgent } from "./completion-query-normalizer-agent"

const EMPTY_OR_DEICTIC_QUERY_PATTERN = /^(?:這件事|這個任務|這個|那個|剛剛那個|剛才那個|上一個|上個)?$/u
const INTERROGATIVE_QUERY_PATTERN = /(?:什麼|哪個|哪一個|哪件|哪件事|何者|啥)$/u

/**
 * Pure text cleanup — lowercase, collapse whitespace, trim.
 * Used by lexicalMatchScore() for string comparison only; no NLU.
 */
export function normalizeCompletionQueryText(text: string): string {
  return normalizeCompletionInputText(text)
}

/**
 * @deprecated Use normalizeCompletionQueryText() for text cleanup
 * or resolveCompletionQuery() for NLU task name extraction.
 */
export function normalizeCompletionQuery(text: string): string {
  return normalizeCompletionQueryText(text)
}

export function isStableCompletionQuery(query: string): boolean {
  const trimmed = query.trim()
  return Boolean(trimmed)
    && !EMPTY_OR_DEICTIC_QUERY_PATTERN.test(trimmed)
    && !INTERROGATIVE_QUERY_PATTERN.test(trimmed)
}

export function isCompletionStatusStatement(text: string): boolean {
  return isCompletionStatusStatementZhTw(text)
}

/**
 * LLM-primary task name extraction from a user's completion statement.
 * Falls back to basic text cleanup if the LLM agent is unavailable.
 */
export async function resolveCompletionQuery(
  text: string,
  options?: { fallbackAgent?: Pick<StructuredCompletionQueryNormalizer, "normalize"> | null },
): Promise<string> {
  const agent = options?.fallbackAgent ?? getCompletionQueryNormalizerAgent()

  if (agent) {
    try {
      const decision = await agent.normalize(text)
      if (decision && decision.confidence >= 0.7) {
        const cleaned = normalizeCompletionQueryText(decision.query)
        if (cleaned && !EMPTY_OR_DEICTIC_QUERY_PATTERN.test(cleaned)) {
          return cleaned
        }
      }
    } catch {
      // fall through to text cleanup
    }
  }

  // Fallback: basic text cleanup only
  return normalizeCompletionQueryText(text)
}
