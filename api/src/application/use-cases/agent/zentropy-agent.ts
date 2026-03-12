/**
 * ZentropyAgent 工廠
 *
 * 組合 Skills + Model → NaruAgent（直接使用原版 naru-agent-js）
 */

import {
  LLMStructuredClassifier,
} from "naru-agent-js"
import { AgentIntentSchema, type AgentIntent } from "./agent-intent"
import { createBrainDumpSkill } from "./brain-dump-skill"
import { createReorganizeSkill } from "./reorganize-skill"
import { createPlannerSkill } from "./planner-skill"
import { createQueryTasksSkill } from "./query-tasks-skill"
import { createQueryCalendarSkill } from "./query-calendar-skill"
import { createAdjustTagsSkill } from "./adjust-tags-skill"
import { createCompleteTaskSkill } from "./complete-task-skill"
import { StructuredFallbackAgentIntentResolver } from "./agent-intent-resolver"
import { getAgentRuntime } from "./agent-runtime"
import { LifecycleAwareAgent } from "./lifecycle-aware-agent"
import { ToolFirstAgent } from "./tool-first-agent"
import { AgentChatTurnLogger } from "./agent-chat-turn-logger"
import { GroqPromptGuardrail } from "@/application/services/groq-prompt-guardrail"
import { getAgentChatModel, getAgentRoutingMode, getAgentSummaryModel } from "@/lib/agent-model"
import { createDecisionFallbackAgent, createResponseAgent, type AgentRuntimeParts } from "./agent-factories"
import { DECISION_PROMPT } from "./decision-prompt"

function buildExperimentalGuardrails() {
  if (process.env.AGENT_PROMPT_GUARD_ENABLED !== "true") {
    return undefined
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.warn("[agent] AGENT_PROMPT_GUARD_ENABLED=true but GROQ_API_KEY is missing")
    return undefined
  }

  return [
    new GroqPromptGuardrail({
      apiKey,
      model: process.env.AGENT_PROMPT_GUARD_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      classificationMode: (process.env.AGENT_PROMPT_GUARD_MODE as "numeric_threshold" | "safe_unsafe_label" | undefined)
        || "safe_unsafe_label",
      blockThreshold: Number(process.env.AGENT_PROMPT_GUARD_BLOCK_THRESHOLD || "0.5"),
    }),
  ]
}

export function createZentropyAgent(userId: string, lineUserId?: string): LifecycleAwareAgent {
  const rawRuntime = getAgentRuntime()
  const guardrails = buildExperimentalGuardrails()
  const chatModel = getAgentChatModel()
  const summaryModel = getAgentSummaryModel()

  // confirmationKey: LINE 用 lineUserId，API 用 api:{userId}
  // 確保所有路徑都有 session-based confirm 流程
  const confirmationKey = lineUserId ?? `api:${userId}`

  const runtime: AgentRuntimeParts = {
    sessionStore: rawRuntime.sessionStore,
    summaryStore: rawRuntime.summaryStore,
    memoryManager: rawRuntime.memoryManager,
    longTermMemoryMode: rawRuntime.longTermMemoryMode,
    chatModel,
    summaryModel,
    guardrails,
  }

  const skills = [
    createBrainDumpSkill(userId),
    createReorganizeSkill(userId),
    createPlannerSkill(userId),
    createQueryTasksSkill(userId),
    createQueryCalendarSkill(userId),
    createCompleteTaskSkill(userId, confirmationKey),
    createAdjustTagsSkill(userId, confirmationKey),
  ]

  const baseAgent = createResponseAgent(runtime, skills)

  const decisionAgent = createDecisionFallbackAgent(runtime)

  const intentResolver = new StructuredFallbackAgentIntentResolver({
    decisionAgent,
    model: chatModel,
    classifier: new LLMStructuredClassifier<AgentIntent>({
      name: "zentropy-agent-intent-v1",
      model: chatModel,
      schema: AgentIntentSchema,
      systemPrompt: DECISION_PROMPT,
    }),
  })

  const agent = getAgentRoutingMode() === "tool_first"
    ? new ToolFirstAgent({
        delegate: baseAgent,
        sessionStore: rawRuntime.sessionStore,
        metaStore: rawRuntime.metaStore,
        memoryManager: rawRuntime.longTermMemoryMode === "each_turn" ? rawRuntime.memoryManager : null,
        lineUserId: confirmationKey,
        intentResolver,
      })
    : baseAgent

  return new LifecycleAwareAgent(
    agent,
    rawRuntime.lifecycleService,
    userId,
    lineUserId ? "LINE" : "API",
    new AgentChatTurnLogger(),
  )
}
