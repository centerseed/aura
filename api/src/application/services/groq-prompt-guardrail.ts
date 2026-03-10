import type { BaseGuardrail, GuardrailResult } from "naru-agent-js/dist/guardrails/base.js"
import { GroqPromptGuardClient } from "@/lib/groq-prompt-guard"

interface GroqPromptGuardrailConfig {
  apiKey: string
  model?: string
  classificationMode?: "numeric_threshold" | "safe_unsafe_label"
  blockThreshold?: number
  blockedMessage?: string
  logger?: Pick<Console, "warn">
}

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
const DEFAULT_CLASSIFICATION_MODE = "safe_unsafe_label"
const DEFAULT_BLOCK_THRESHOLD = 0.5
const DEFAULT_BLOCKED_MESSAGE = "這個請求目前無法處理，請換個方式描述。"

export class GroqPromptGuardrail implements BaseGuardrail {
  private readonly client: GroqPromptGuardClient
  private readonly blockedMessage: string
  private readonly logger: Pick<Console, "warn">

  constructor(config: GroqPromptGuardrailConfig) {
    this.client = new GroqPromptGuardClient({
      apiKey: config.apiKey,
      model: config.model ?? DEFAULT_MODEL,
      classificationMode: config.classificationMode ?? DEFAULT_CLASSIFICATION_MODE,
      blockThreshold: config.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD,
    })
    this.blockedMessage = config.blockedMessage ?? DEFAULT_BLOCKED_MESSAGE
    this.logger = config.logger ?? console
  }

  async checkInput(message: string): Promise<GuardrailResult> {
    const result = await this.client.classify(message)

    if (result.verdict === "block") {
      return {
        passed: false,
        modifiedText: null,
        reason: this.blockedMessage,
      }
    }

    if (result.verdict === "error") {
      this.logger.warn("[groq-prompt-guardrail] classify failed", {
        reason: result.reason,
        raw: result.raw,
      })
    }

    return {
      passed: true,
      modifiedText: null,
      reason: null,
    }
  }

  async checkOutput(): Promise<GuardrailResult> {
    return {
      passed: true,
      modifiedText: null,
      reason: null,
    }
  }
}
