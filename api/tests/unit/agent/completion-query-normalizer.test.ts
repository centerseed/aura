import { describe, expect, it, vi } from "vitest"
import {
  normalizeCompletionQuery,
  resolveCompletionQuery,
  shouldUseCompletionNormalizationFallback,
} from "@/application/use-cases/agent/completion-query-normalizer"

describe("completion-query-normalizer hybrid path", () => {
  it("keeps deterministic normalization as the baseline", () => {
    expect(normalizeCompletionQuery("剛把書桌整理完了")).toBe("書桌整理")
    expect(normalizeCompletionQuery("我今天已經跑完步了，幫我標記完成")).toBe("跑步")
  })

  it.each([
    ["剛剛把 email 寄給客戶了", "email 寄給客戶"],
    ["剛才把報告送出了", "報告送出"],
    ["我剛把 API 文件整理好了", "api 文件整理"],
    ["我今天已經把客戶名單更新完了", "客戶名單更新"],
    ["信已經發出去給客戶了", "信發給客戶"],
    ["幫我把買牛奶標記完成", "買牛奶"],
    ["這個 done 了", ""],
  ])("covers additional zh-TW completion phrasings: %s -> %s", (input, expected) => {
    expect(normalizeCompletionQuery(input)).toBe(expected)
  })

  it("detects suspicious deterministic leftovers before using fallback", () => {
    expect(shouldUseCompletionNormalizationFallback("剛把書桌整理完了", "剛書桌整理完")).toBe(true)
    expect(shouldUseCompletionNormalizationFallback("我今天已經跑完步了，幫我標記完成", "跑步")).toBe(true)
    expect(shouldUseCompletionNormalizationFallback("跑步完成了", "跑步")).toBe(false)
  })

  it("uses the small fallback agent only when deterministic output looks suspicious", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "書桌整理",
        confidence: 0.93,
      }),
    }

    const resolved = await resolveCompletionQuery("剛把書桌整理完了", {
      fallbackAgent,
    })

    expect(resolved).toBe("書桌整理")
    expect(fallbackAgent.normalize).toHaveBeenCalledWith("剛把書桌整理完了")
  })

  it("accepts fallback output for multi-clause completion phrasing", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "跑步",
        confidence: 0.91,
      }),
    }

    const resolved = await resolveCompletionQuery("我今天已經跑完步了，幫我標記完成", {
      fallbackAgent,
    })

    expect(fallbackAgent.normalize).toHaveBeenCalledWith("我今天已經跑完步了，幫我標記完成")
    expect(resolved).toBe("跑步")
  })

  it("falls back to deterministic output when agent confidence is too low", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "晨跑",
        confidence: 0.4,
      }),
    }

    const resolved = await resolveCompletionQuery("我今天已經跑完步了，幫我標記完成", {
      fallbackAgent,
    })

    expect(resolved).toBe("跑步")
  })

  it.each([
    ["我今天已經把 API 文件整理好了，幫我標記完成", "整理 API 文件"],
    ["剛才把書桌整理完了", "整理書桌"],
  ])("accepts fallback rewrites for varied completion phrasing: %s", async (input, fallbackQuery) => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: fallbackQuery,
        confidence: 0.92,
      }),
    }

    const resolved = await resolveCompletionQuery(input, { fallbackAgent })

    expect(fallbackAgent.normalize).toHaveBeenCalledWith(input)
    expect(resolved).toBe(normalizeCompletionQuery(fallbackQuery))
  })

  it("keeps deterministic result when a shorter completion phrase is already stable", async () => {
    const fallbackAgent = {
      normalize: vi.fn().mockResolvedValue({
        query: "寄 email 給客戶",
        confidence: 0.95,
      }),
    }

    const resolved = await resolveCompletionQuery("剛剛把 email 寄給客戶了", { fallbackAgent })

    expect(resolved).toBe("email 寄給客戶")
    expect(fallbackAgent.normalize).not.toHaveBeenCalled()
  })

  it("does not invoke fallback for simple deterministic queries", async () => {
    const fallbackAgent = {
      normalize: vi.fn(),
    }

    const resolved = await resolveCompletionQuery("買牛奶完成了", { fallbackAgent })

    expect(resolved).toBe("買牛奶")
    expect(fallbackAgent.normalize).not.toHaveBeenCalled()
  })
})
