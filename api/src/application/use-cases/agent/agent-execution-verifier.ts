const EFFECT_CLAIM_PATTERNS: RegExp[] = [
  /(?:^|[\s✅])已記錄(?:\s|$|並|但|\d)/u,
  /(?:^|[\s✅])已完成(?:\s|$|「|分類調整)/u,
  /(?:^|[\s✅])已更新(?:\s|$)/u,
  /(?:^|[\s✅])已新增(?:\s|$|\d)/u,
  /任務已封存/u,
]

// P0 safety: only these tools actually perform mutations
export const MUTATION_TOOL_NAMES = new Set([
  "brain_dump",
  "complete_task_search",
  "adjust_tags_preview",
  "reorganize_preview",
  "run_planner",
])

// Tool output patterns that indicate the mutation did NOT succeed
const SOFT_FAILURE_PATTERNS: RegExp[] = [
  /找不到/u,
  /無法/u,
  /失敗/u,
  /不存在/u,
  /沒有.*任務/u,
  /錯誤/u,
]

export interface AgentExecutionResultLike {
  content?: unknown
  toolCalls?: unknown
  toolOutputs?: unknown
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

export function hasToolOutputSoftFailure(toolOutputs: unknown): boolean {
  if (!Array.isArray(toolOutputs)) return false
  return toolOutputs.some((output) => {
    if (typeof output !== "string") return false
    return SOFT_FAILURE_PATTERNS.some((pattern) => pattern.test(output))
  })
}

export function verifyAgentExecutionResult<T extends AgentExecutionResultLike>(result: T): T {
  const toolCalls = Array.isArray(result.toolCalls)
    ? result.toolCalls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : []

  if (toolCalls.length > 0) {
    // Has tool calls — but if claiming side effect, verify at least one is a mutation tool
    if (typeof result.content === "string" && hasEffectClaim(result.content)) {
      if (!toolCalls.some((name) => MUTATION_TOOL_NAMES.has(name))) {
        throw new AgentExecutionVerificationError(
          "Agent claimed side effect but only query tools were called",
        )
      }

      // Mutation tool was called, but did it actually succeed?
      if (hasToolOutputSoftFailure(result.toolOutputs)) {
        throw new AgentExecutionVerificationError(
          "Agent claimed side effect but tool output indicates failure",
        )
      }
    }
    return result
  }

  if (hasSelectedToolTrace(result.trace)) {
    return result
  }

  if (typeof result.content === "string" && hasEffectClaim(result.content)) {
    throw new AgentExecutionVerificationError()
  }

  return result
}
