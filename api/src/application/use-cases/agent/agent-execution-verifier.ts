const EFFECT_CLAIM_PATTERNS: RegExp[] = [
  /(?:^|[\s✅])已記錄(?:\s|$|並|但|\d)/u,
  /(?:^|[\s✅])已完成(?:\s|$|「|分類調整)/u,
  /(?:^|[\s✅])已更新(?:\s|$)/u,
  /(?:^|[\s✅])已新增(?:\s|$|\d)/u,
  /任務已封存/u,
]

export interface AgentExecutionResultLike {
  content?: unknown
  toolCalls?: unknown
  trace?: unknown
}

export class AgentExecutionVerificationError extends Error {
  constructor(message = "Agent response claimed a side effect without execution proof") {
    super(message)
    this.name = "AgentExecutionVerificationError"
  }
}

function hasSelectedToolTrace(trace: unknown): boolean {
  if (!trace || typeof trace !== "object") return false
  const selectedTool = (trace as { selectedTool?: unknown }).selectedTool
  return typeof selectedTool === "string" && selectedTool.trim().length > 0
}

export function hasEffectClaim(content: string): boolean {
  const text = content.trim()
  if (!text) return false
  return EFFECT_CLAIM_PATTERNS.some((pattern) => pattern.test(text))
}

export function verifyAgentExecutionResult<T extends AgentExecutionResultLike>(result: T): T {
  const toolCalls = Array.isArray(result.toolCalls)
    ? result.toolCalls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : []

  if (toolCalls.length > 0 || hasSelectedToolTrace(result.trace)) {
    return result
  }

  if (typeof result.content === "string" && hasEffectClaim(result.content)) {
    throw new AgentExecutionVerificationError()
  }

  return result
}
