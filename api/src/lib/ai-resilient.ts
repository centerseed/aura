/**
 * Resilient AI wrapper — retry + timeout for generateObject calls
 *
 * Gemini Flash Lite 的已知問題：
 * 1. Socket closed（網路不穩）
 * 2. Schema mismatch（structured output 偶發不符 schema）
 *
 * 這個 wrapper 統一處理，避免每個呼叫點各自 try-catch。
 */

import { generateObject, type GenerateObjectResult } from "ai"

const DEFAULT_MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

type GenerateObjectParams = Parameters<typeof generateObject>[0]

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message

  // Schema mismatch (Gemini returns malformed JSON)
  if (msg.includes("No object generated")) return true

  // Network errors
  if (msg.includes("socket") || msg.includes("ECONNRESET")) return true
  if (msg.includes("fetch failed") || msg.includes("network")) return true
  if (msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED")) return true

  // Google API transient errors
  if (msg.includes("503") || msg.includes("429") || msg.includes("500")) return true

  return false
}

export async function resilientGenerateObject<T>(
  params: GenerateObjectParams & { schema: import("zod").ZodType<T> },
  options?: { maxRetries?: number },
): Promise<GenerateObjectResult<T>> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateObject(params) as GenerateObjectResult<T>
    } catch (err) {
      lastError = err

      if (attempt < maxRetries && isRetryableError(err)) {
        const delay = RETRY_DELAY_MS * (attempt + 1)
        console.warn(
          `[ai-resilient] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${err instanceof Error ? err.message : String(err)}. Retrying in ${delay}ms...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw err
    }
  }

  throw lastError
}
