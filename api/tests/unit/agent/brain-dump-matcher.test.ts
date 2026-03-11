import { describe, expect, it } from "vitest"
import {
  isInterrogativeSpeechAct,
  hasExplicitBrainDumpFrame,
  detectBrainDumpActivation,
} from "@/application/use-cases/agent/brain-dump-matcher"

describe("isInterrogativeSpeechAct", () => {
  it.each([
    ["今天要幹嘛", "幹嘛"],
    ["有什麼待辦", "什麼"],
    ["還有哪些事沒做", "哪些"],
    ["今天有事嗎", "嗎"],
    ["今天要做什麼？", "？"],
    ["有沒有什麼要做的", "有沒有"],
    ["怎麼安排今天", "怎麼"],
    ["幾個任務還沒做", "幾個"],
  ])("returns true for '%s' (marker: %s)", (input) => {
    expect(isInterrogativeSpeechAct(input)).toBe(true)
  })

  it.each([
    ["今天要去跑步"],
    ["明天要開會"],
    ["幫我記一下買牛奶"],
    ["待辦：準備報告"],
    ["下週要提交文件"],
  ])("returns false for statement '%s'", (input) => {
    expect(isInterrogativeSpeechAct(input)).toBe(false)
  })
})

describe("hasExplicitBrainDumpFrame", () => {
  it("returns false when NON_BRAIN_DUMP pattern matches (query about 待辦)", () => {
    expect(hasExplicitBrainDumpFrame("幫我看一下有什麼待辦")).toBe(false)
  })

  it("returns false for query about 任務", () => {
    expect(hasExplicitBrainDumpFrame("有哪些任務")).toBe(false)
  })

  it("returns true for genuine capture with 待辦 framing", () => {
    expect(hasExplicitBrainDumpFrame("待辦：買牛奶")).toBe(true)
  })

  it("returns true for explicit capture request", () => {
    expect(hasExplicitBrainDumpFrame("幫我記一下明天開會")).toBe(true)
  })
})

describe("detectBrainDumpActivation", () => {
  it("only matches explicit capture frames", () => {
    expect(detectBrainDumpActivation("幫我記一下買牛奶").matched).toBe(true)
    expect(detectBrainDumpActivation("待辦：準備報告").matched).toBe(true)
  })

  it("does not match implicit statements — LLM fallback handles them", () => {
    expect(detectBrainDumpActivation("今天要去跑步").matched).toBe(false)
    expect(detectBrainDumpActivation("明天要開會").matched).toBe(false)
    expect(detectBrainDumpActivation("對了還要買咖啡").matched).toBe(false)
  })

  it("does not match interrogative sentences", () => {
    expect(detectBrainDumpActivation("今天要幹嘛").matched).toBe(false)
    expect(detectBrainDumpActivation("還有哪些事沒做").matched).toBe(false)
  })
})
