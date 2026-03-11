import { describe, expect, it, vi } from "vitest"
import {
  buildPlannerPlacementNotice,
  buildPlannerDueDates,
  formatPlannerPlacementPath,
  normalizePlanningGoalFromMessage,
  pickPlannerFallbackProduct,
  resolvePlannerPlacement,
} from "@/application/use-cases/agent/planner-skill"

describe("normalizePlanningGoalFromMessage", () => {
  it("strips planning command prefixes while preserving the actual goal", () => {
    expect(normalizePlanningGoalFromMessage("幫我規劃學英文的計畫")).toBe("學英文的計畫")
    expect(normalizePlanningGoalFromMessage("請幫我拆解準備轉職的步驟")).toBe("準備轉職的步驟")
  })

  it("falls back to the original message when no command frame is present", () => {
    expect(normalizePlanningGoalFromMessage("建立個人作品集網站")).toBe("建立個人作品集網站")
  })

  it("rejects empty or undefined-like inputs", () => {
    expect(normalizePlanningGoalFromMessage("")).toBe("")
    expect(normalizePlanningGoalFromMessage("undefined")).toBe("")
  })
})

describe("buildPlannerDueDates", () => {
  it("accumulates due dates in task order", () => {
    const dates = buildPlannerDueDates(
      [
        { estimated_days: 2 },
        { estimated_days: 3 },
        {},
      ],
      undefined,
      new Date("2026-03-11T00:00:00.000Z"),
    )

    expect(dates).toEqual([
      "2026-03-13",
      "2026-03-16",
      "2026-03-17",
    ])
  })

  it("uses the explicit due date as an override for all tasks", () => {
    const dates = buildPlannerDueDates(
      [{ estimated_days: 2 }, { estimated_days: 5 }],
      "2026-03-31",
      new Date("2026-03-11T00:00:00.000Z"),
    )

    expect(dates).toEqual(["2026-03-31", "2026-03-31"])
  })
})

describe("pickPlannerFallbackProduct", () => {
  it("prefers an existing generic catch-all product before arbitrary products", () => {
    const placement = pickPlannerFallbackProduct([
      {
        id: "area-1",
        name: "事業",
        scope: null,
        products: [{ id: "product-a", name: "Zentropy" }],
      },
      {
        id: "area-2",
        name: "一般",
        scope: null,
        products: [{ id: "product-b", name: "未分類" }],
      },
    ])

    expect(placement).toEqual({
      areaId: "area-2",
      areaName: "一般",
      productId: "product-b",
      productName: "未分類",
      displayProductName: "待整理",
    })
  })
})

describe("planner placement formatting", () => {
  it("formats area and normalized product name into a readable path", () => {
    expect(formatPlannerPlacementPath({
      areaName: "一般",
      displayProductName: "待整理",
      productName: "未分類",
      productId: "product-1",
    })).toBe("一般 / 待整理")
  })

  it("builds a user-facing notice that includes planner and brain dump placement", () => {
    expect(buildPlannerPlacementNotice({
      areaName: "事業",
      displayProductName: "Zentropy",
      productName: "Zentropy",
      productId: "product-2",
    })).toBe("📍選到的 Area / Project：事業 / Zentropy\n🧠 Brain dump 落點：事業 / Zentropy")
  })
})

describe("resolvePlannerPlacement", () => {
  it("returns the given product name without extra lookup when already known", async () => {
    const findUnique = vi.fn()

    await expect(
      resolvePlannerPlacement(
        {
          area: { findMany: vi.fn() },
          product: { findUnique },
        },
        "user-1",
        "學習社群爬蟲",
        "product-123",
        "既有專案",
      ),
    ).resolves.toEqual({
      areaId: "",
      areaName: "",
      productId: "product-123",
      productName: "既有專案",
      displayProductName: "既有專案",
    })

    expect(findUnique).toHaveBeenCalledTimes(1)
  })
})
