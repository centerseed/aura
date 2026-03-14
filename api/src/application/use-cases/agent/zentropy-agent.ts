/**
 * ZentropyAgent 工廠
 *
 * 組合 Skills + Model → NaruAgent + AgentOrchestrator（使用 @centerseedwu/naru-agent v0.2.0）
 *
 * 架構：
 *   NaruAgent (delegate) — skills 執行 + LLM 路由
 *   AgentOrchestrator (新套件) — Phase 0/1/2/3 pipeline
 *     Phase 1: IntentResolverAdapter → StructuredFallbackAgentIntentResolver
 *     Phase 2: [PendingConfirmationExecutor, DirectExecutorAdapter]
 *     Phase 3: NaruAgent delegate
 */

import {
  AgentOrchestrator,
  LLMStructuredClassifier,
} from "@centerseedwu/naru-agent"
import type { OrchestrationResult } from "@centerseedwu/naru-agent"
import { AgentIntentSchema, type AgentIntent } from "./agent-intent"
import { createBrainDumpSkill } from "./brain-dump-skill"
import { createReorganizeSkill } from "./reorganize-skill"
import { createPlannerSkill } from "./planner-skill"
import { createQueryTasksSkill } from "./query-tasks-skill"
import { createQueryCalendarSkill } from "./query-calendar-skill"
import { createAdjustTagsSkill } from "./adjust-tags-skill"
import { createCompleteTaskSkill } from "./complete-task-skill"
import { StructuredFallbackAgentIntentResolver, IntentResolverAdapter } from "./agent-intent-resolver"
import { getAgentRuntime } from "./agent-runtime"
import { LifecycleAwareAgent } from "./lifecycle-aware-agent"
import { LinePendingStateManager } from "./line-adapter"
import { DirectExecutorAdapter } from "./direct-executor"
import { PendingConfirmationExecutor } from "./pending-confirmation-executor"
import { AgentChatTurnLogger } from "./agent-chat-turn-logger"
import { GroqPromptGuardrail } from "@/application/services/groq-prompt-guardrail"
import { getAgentChatModel, getAgentSummaryModel } from "@/lib/agent-model"
import { createDecisionFallbackAgent, createResponseAgent, type AgentRuntimeParts } from "./agent-factories"
import { DECISION_PROMPT } from "./decision-prompt"
import { AgentSessionStateStore } from "./agent-session-state"
import { extractBrainDumpConfirmationTarget } from "@/lib/line-confirmation"

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

  const innerIntentResolver = new StructuredFallbackAgentIntentResolver({
    decisionAgent,
    model: chatModel,
    classifier: new LLMStructuredClassifier<AgentIntent>({
      name: "zentropy-agent-intent-v1",
      model: chatModel,
      schema: AgentIntentSchema,
      systemPrompt: DECISION_PROMPT,
    }),
  })

  // Adapter: bridges AgentIntentResolver → BaseIntentResolver for new orchestrator
  const intentResolverAdapter = new IntentResolverAdapter(innerIntentResolver)

  // LinePendingStateManager: always uses confirmationKey, not sessionId
  const pendingStateManager = new LinePendingStateManager(confirmationKey)

  // AgentSessionStateStore: persists entity tracking state
  const agentSessionStateStore = rawRuntime.metaStore
    ? new AgentSessionStateStore(rawRuntime.metaStore)
    : undefined

  // DirectExecutorAdapter: bridges existing DirectExecutor → BaseDirectExecutor
  const directExecutorAdapter = new DirectExecutorAdapter(
    {
      userId,
      confirmationKey,
      savePendingState: (sid, type, payload) => pendingStateManager.setPending(sid, {
        type,
        payload: payload as Record<string, unknown>,
        createdAt: Date.now(),
      }),
    },
    rawRuntime.sessionStore,
    agentSessionStateStore
      ? {
          get: (sessionId: string) => agentSessionStateStore.get(sessionId),
          save: (sessionId: string, updater: (current: import("./agent-session-state").AgentSessionState) => import("./agent-session-state").AgentSessionState) =>
            agentSessionStateStore.save(sessionId, updater),
        }
      : undefined,
    intentResolverAdapter,
  )

  // PendingConfirmationExecutor: handles 3 pending types before DirectExecutor runs
  const pendingConfirmationExecutor = new PendingConfirmationExecutor(pendingStateManager)

  // AfterMessage hook: detect brain_dump_pending confirmation prompt from delegate
  const afterMessageHook = async (result: OrchestrationResult): Promise<void> => {
    // Only check delegate route results (Phase 3); direct execution results won't have this
    if (result.decisionTrace.phaseReached !== "delegate") return

    const brainDumpTarget = extractBrainDumpConfirmationTarget(result.content)
    if (!brainDumpTarget) return

    const brainDumpPayload = {
      originalText: brainDumpTarget,
      taskTitle: brainDumpTarget,
    }
    await pendingStateManager.setPending("", {
      type: "brain_dump_pending",
      payload: brainDumpPayload,
      createdAt: Date.now(),
    })
  }

  const agent = new AgentOrchestrator({
    delegate: baseAgent,
    intentResolver: intentResolverAdapter,
    directExecutors: [pendingConfirmationExecutor, directExecutorAdapter],
    lifecycleHooks: {
      afterMessage: afterMessageHook,
    },
  })

  return new LifecycleAwareAgent(
    agent,
    rawRuntime.lifecycleService,
    userId,
    lineUserId ? "LINE" : "API",
    new AgentChatTurnLogger(),
  )
}
