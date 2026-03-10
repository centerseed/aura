import { describe, expect, it } from "vitest"
import { isLineSessionConfirmation } from "@/lib/line-confirmation"

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
