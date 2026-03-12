import { describe, expect, it } from "vitest"
import { isLineSessionConfirmation, classifyConfirmationDisposition, extractBrainDumpConfirmationTarget, parseOrdinalSelection } from "@/lib/line-confirmation"

describe("isLineSessionConfirmation", () => {
  it("accepts exact confirmation phrases and common affirmative replies", () => {
    expect(isLineSessionConfirmation("確認")).toBe(true)
    expect(isLineSessionConfirmation("confirm")).toBe(true)
    expect(isLineSessionConfirmation("沒錯")).toBe(true)
    expect(isLineSessionConfirmation("對")).toBe(true)
    expect(isLineSessionConfirmation("是")).toBe(true)
    expect(isLineSessionConfirmation("好的")).toBe(true)
    expect(isLineSessionConfirmation("OK")).toBe(true)
  })

  it("rejects negative or ambiguous replies", () => {
    expect(isLineSessionConfirmation("不是")).toBe(false)
    expect(isLineSessionConfirmation("先不要")).toBe(false)
    expect(isLineSessionConfirmation("取消")).toBe(false)
    expect(isLineSessionConfirmation("我再想想")).toBe(false)
  })
})

describe("classifyConfirmationDisposition", () => {
  it("returns 'confirm' for affirmative phrases", () => {
    expect(classifyConfirmationDisposition("沒錯")).toBe("confirm")
    expect(classifyConfirmationDisposition("確認")).toBe("confirm")
    expect(classifyConfirmationDisposition("確認調整")).toBe("confirm")
    expect(classifyConfirmationDisposition("好的")).toBe("confirm")
    expect(classifyConfirmationDisposition("對")).toBe("confirm")
    expect(classifyConfirmationDisposition("OK")).toBe("confirm")
    expect(classifyConfirmationDisposition("  是  ")).toBe("confirm")
  })

  it("returns 'reject' for rejection phrases", () => {
    expect(classifyConfirmationDisposition("算了")).toBe("reject")
    expect(classifyConfirmationDisposition("取消")).toBe("reject")
    expect(classifyConfirmationDisposition("不要")).toBe("reject")
    expect(classifyConfirmationDisposition("先不要")).toBe("reject")
    expect(classifyConfirmationDisposition("我再想想")).toBe("reject")
    expect(classifyConfirmationDisposition("不用了")).toBe("reject")
  })

  it("returns 'override' for new intent input", () => {
    expect(classifyConfirmationDisposition("改成另一個")).toBe("override")
    expect(classifyConfirmationDisposition("幫我記另一件事")).toBe("override")
    expect(classifyConfirmationDisposition("改成跑步")).toBe("override")
    expect(classifyConfirmationDisposition("我要記一個新任務")).toBe("override")
  })

  it("returns 'override' for unrecognized phrases", () => {
    expect(classifyConfirmationDisposition("隨便")).toBe("override")
    expect(classifyConfirmationDisposition("其實我想")).toBe("override")
  })
})

describe("extractBrainDumpConfirmationTarget", () => {
  it("extracts pending capture target from plain confirmation prompts", () => {
    expect(extractBrainDumpConfirmationTarget("你想要我記錄「修復 webhook 問題」嗎？")).toBe("修復 webhook 問題")
    expect(extractBrainDumpConfirmationTarget("要幫你記下「買牛奶」嗎？")).toBe("買牛奶")
  })
})

describe("parseOrdinalSelection", () => {
  it("parses numeric and ordinal selections", () => {
    expect(parseOrdinalSelection("1", 3)).toBe(1)
    expect(parseOrdinalSelection("第 2 個", 3)).toBe(2)
    expect(parseOrdinalSelection("第二個", 3)).toBe(2)
    expect(parseOrdinalSelection("最後一個", 3)).toBe(3)
  })

  it("returns null for invalid selections", () => {
    expect(parseOrdinalSelection("確認", 3)).toBeNull()
    expect(parseOrdinalSelection("第五個", 3)).toBeNull()
    expect(parseOrdinalSelection("4", 3)).toBeNull()
  })
})
