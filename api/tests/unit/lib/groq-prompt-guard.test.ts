import { afterEach, describe, expect, it, vi } from "vitest"
import { GroqPromptGuardClient } from "@/lib/groq-prompt-guard"

describe("GroqPromptGuardClient", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns allow when score is below threshold", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "0.002" } }],
      }),
    }))

    const client = new GroqPromptGuardClient({
      apiKey: "test-key",
      model: "meta-llama/llama-prompt-guard-2-22m",
      classificationMode: "numeric_threshold",
      blockThreshold: 0.5,
    })

    await expect(client.classify("hello")).resolves.toEqual({
      verdict: "allow",
      score: 0.002,
      raw: "0.002",
      reason: null,
    })
  })

  it("returns block when score is above threshold", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "0.8" } }],
      }),
    }))

    const client = new GroqPromptGuardClient({
      apiKey: "test-key",
      model: "meta-llama/llama-prompt-guard-2-22m",
      classificationMode: "numeric_threshold",
      blockThreshold: 0.5,
    })

    await expect(client.classify("unsafe")).resolves.toEqual({
      verdict: "block",
      score: 0.8,
      raw: "0.8",
      reason: null,
    })
  })

  it("returns block when SAFE/UNSAFE classifier says UNSAFE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "UNSAFE" } }],
      }),
    }))

    const client = new GroqPromptGuardClient({
      apiKey: "test-key",
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      classificationMode: "safe_unsafe_label",
    })

    await expect(client.classify("bomb")).resolves.toEqual({
      verdict: "block",
      score: null,
      raw: "UNSAFE",
      reason: null,
    })
  })
})
