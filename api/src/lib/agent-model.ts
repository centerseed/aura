import { google } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"

export type AgentPrimaryProvider = "groq" | "gemini"
export type AgentRoutingMode = "provider_default" | "tool_first"

const DEFAULT_GROQ_CHAT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite"
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"

let groqFactory: ReturnType<typeof createOpenAI> | null = null

function parsePrimaryProvider(rawValue: string | undefined): AgentPrimaryProvider {
  switch (rawValue) {
    case undefined:
    case "":
    case "groq":
      return "groq"
    case "gemini":
      return "gemini"
    default:
      console.warn(`[agent-model] Unknown AGENT_PRIMARY_PROVIDER=${rawValue}, fallback to groq`)
      return "groq"
  }
}

function parseRoutingMode(rawValue: string | undefined): AgentRoutingMode {
  switch (rawValue) {
    case undefined:
    case "":
    case "tool_first":
      return "tool_first"
    case "provider_default":
      return "provider_default"
    default:
      console.warn(`[agent-model] Unknown AGENT_ROUTING_MODE=${rawValue}, fallback to tool_first`)
      return "tool_first"
  }
}

function getGroqFactory() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required when AGENT_PRIMARY_PROVIDER=groq")
  }

  if (!groqFactory) {
    groqFactory = createOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: DEFAULT_GROQ_BASE_URL,
    })
  }

  return groqFactory
}

function getGroqChatModelName(): string {
  return process.env.AGENT_GROQ_MODEL || DEFAULT_GROQ_CHAT_MODEL
}

function getGeminiChatModelName(): string {
  return process.env.AGENT_GEMINI_MODEL || DEFAULT_GEMINI_CHAT_MODEL
}

function createGroqChatModel() {
  // Groq 的 OpenAI-compatible endpoint 對 AI SDK 預設 `/responses` 相容性不完整。
  // Agent 需要多輪歷史與工具協作時，必須固定使用 chat-completions 路徑。
  return getGroqFactory().chat(getGroqChatModelName())
}

function createGeminiChatModel() {
  return google(getGeminiChatModelName())
}

export function getAgentPrimaryProvider(): AgentPrimaryProvider {
  return parsePrimaryProvider(process.env.AGENT_PRIMARY_PROVIDER)
}

export function getAgentRoutingMode(): AgentRoutingMode {
  return parseRoutingMode(process.env.AGENT_ROUTING_MODE)
}

export function getAgentChatModel() {
  switch (getAgentPrimaryProvider()) {
    case "groq":
      return createGroqChatModel()
    case "gemini":
      return createGeminiChatModel()
  }
}

export function getAgentSummaryModel() {
  // Summary 跟主對話模型共用同一個 provider 選擇，避免切 provider 時只有一半被切換。
  return getAgentChatModel()
}

export function getAgentChatModelName(): string {
  switch (getAgentPrimaryProvider()) {
    case "groq":
      return getGroqChatModelName()
    case "gemini":
      return getGeminiChatModelName()
  }
}
