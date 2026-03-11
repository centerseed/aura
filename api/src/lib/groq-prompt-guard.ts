import { logAgentLlmCall, normalizeAgentUsage } from "@/application/use-cases/agent/llm-logging"

type GroqPromptGuardVerdict = "allow" | "block" | "error"

export interface GroqPromptGuardResult {
  verdict: GroqPromptGuardVerdict
  score: number | null
  raw: string | null
  reason: string | null
}

interface GroqPromptGuardConfig {
  apiKey: string
  model: string
  blockThreshold?: number
  classificationMode?: "numeric_threshold" | "safe_unsafe_label"
  timeoutMs?: number
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_TIMEOUT_MS = 3000

function normalizeScore(raw: string): number | null {
  const value = Number(raw.trim())
  if (!Number.isFinite(value)) return null
  return value
}

export class GroqPromptGuardClient {
  private readonly timeoutMs: number

  constructor(private readonly config: GroqPromptGuardConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async classify(message: string): Promise<GroqPromptGuardResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const startedAt = Date.now()

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.buildMessages(message),
          temperature: 0,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        return {
          verdict: "error",
          score: null,
          raw: null,
          reason: `groq_http_${response.status}`,
        }
      }

      const json = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
      }
      const usage = normalizeAgentUsage({
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens,
      })
      const raw = json.choices?.[0]?.message?.content ?? null
      if (!raw) {
        return {
          verdict: "error",
          score: null,
          raw: null,
          reason: "groq_empty_response",
        }
      }

      const parsed = this.parseVerdict(raw)
      if (!parsed) {
        return {
          verdict: "error",
          score: null,
          raw,
          reason: "groq_unparseable_response",
        }
      }

      logAgentLlmCall({
        event: "agent_llm_call",
        feature: "groq_prompt_guard",
        latencyMs: Date.now() - startedAt,
        usage,
        model: this.config.model,
        metadata: {
          classificationMode: this.config.classificationMode ?? "numeric_threshold",
          verdict: parsed.verdict,
        },
      })

      return {
        verdict: parsed.verdict,
        score: parsed.score,
        raw,
        reason: null,
      }
    } catch (error: any) {
      return {
        verdict: "error",
        score: null,
        raw: null,
        reason: error?.name === "AbortError" ? "groq_timeout" : "groq_fetch_failed",
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private buildMessages(message: string): Array<{ role: "system" | "user"; content: string }> {
    if (this.config.classificationMode === "safe_unsafe_label") {
      return [
        {
          role: "system",
          content: "You are a safety classifier. Answer with exactly one word: SAFE or UNSAFE.",
        },
        {
          role: "user",
          content: message,
        },
      ]
    }

    return [{ role: "user", content: message }]
  }

  private parseVerdict(raw: string): { verdict: "allow" | "block"; score: number | null } | null {
    if (this.config.classificationMode === "safe_unsafe_label") {
      const normalized = raw.trim().toUpperCase()
      if (normalized === "SAFE") {
        return { verdict: "allow", score: null }
      }
      if (normalized === "UNSAFE") {
        return { verdict: "block", score: null }
      }
      return null
    }

    const score = normalizeScore(raw)
    if (score === null) return null
    return {
      verdict: score >= (this.config.blockThreshold ?? 0.5) ? "block" : "allow",
      score,
    }
  }
}
