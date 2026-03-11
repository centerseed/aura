import { describe, expect, it } from "vitest"
import {
  validateBrainDumpStructureResult,
  type StructureResult,
} from "@/application/use-cases/brain-dump/generate-brain-dump-structure"

describe("validateBrainDumpStructureResult", () => {
  it("accepts append_sub_item when sub_items and target_task_ids are present", () => {
    const result: StructureResult = {
      action: "append_sub_item",
      target_task_ids: ["550e8400-e29b-41d4-a716-446655440000"],
      sub_items: [{ content: "補上測試案例" }],
      reasoning: "追加到既有任務",
    }

    expect(validateBrainDumpStructureResult(result)).toEqual(result)
  })

  it("rejects append_sub_item without sub_items", () => {
    expect(() =>
      validateBrainDumpStructureResult({
        action: "append_sub_item",
        target_task_ids: ["550e8400-e29b-41d4-a716-446655440000"],
        reasoning: "模型漏欄位",
      } as StructureResult),
    ).toThrow(/sub_items/)
  })

  it("rejects append_sub_item without target_task_ids", () => {
    expect(() =>
      validateBrainDumpStructureResult({
        action: "append_sub_item",
        sub_items: [{ content: "補上測試案例" }],
        reasoning: "模型漏欄位",
      } as StructureResult),
    ).toThrow(/target_task_ids/)
  })

  it("rejects create_new_tasks without items", () => {
    expect(() =>
      validateBrainDumpStructureResult({
        action: "create_new_tasks",
      } as StructureResult),
    ).toThrow(/items/)
  })
})
