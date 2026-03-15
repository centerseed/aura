import { normalizeCompletionInputText } from "./completion-query-normalizer/core"

/**
 * Pure text cleanup — lowercase, collapse whitespace, trim.
 * Used by lexicalMatchScore() for string comparison only; no NLU.
 */
export function normalizeCompletionQueryText(text: string): string {
  return normalizeCompletionInputText(text)
}
