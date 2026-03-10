import { afterEach, describe, expect, it, vi } from "vitest"

describe("agent-model", () => {
  afterEach(() => {
    vi.resetModules()
    delete process.env.AGENT_PRIMARY_PROVIDER
    delete process.env.AGENT_ROUTING_MODE
    delete process.env.AGENT_GEMINI_MODEL
    delete process.env.AGENT_GROQ_MODEL
  })

  it("defaults to groq provider and tool_first routing", async () => {
    const mod = await import("@/lib/agent-model")

    expect(mod.getAgentPrimaryProvider()).toBe("groq")
    expect(mod.getAgentRoutingMode()).toBe("tool_first")
    expect(mod.getAgentChatModelName()).toBe("meta-llama/llama-4-scout-17b-16e-instruct")
  })

  it("uses gemini provider and configured gemini model name", async () => {
    process.env.AGENT_PRIMARY_PROVIDER = "gemini"
    process.env.AGENT_GEMINI_MODEL = "gemini-test-model"

    const mod = await import("@/lib/agent-model")

    expect(mod.getAgentPrimaryProvider()).toBe("gemini")
    expect(mod.getAgentChatModelName()).toBe("gemini-test-model")
  })

  it("parses provider_default routing mode", async () => {
    process.env.AGENT_ROUTING_MODE = "provider_default"

    const mod = await import("@/lib/agent-model")

    expect(mod.getAgentRoutingMode()).toBe("provider_default")
  })
})
