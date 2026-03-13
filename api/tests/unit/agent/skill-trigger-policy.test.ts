import { describe, expect, it } from "vitest"
import { createBrainDumpSkill } from "@/application/use-cases/agent/brain-dump-skill"
import { createReorganizeSkill } from "@/application/use-cases/agent/reorganize-skill"
import { createQueryTasksSkill } from "@/application/use-cases/agent/query-tasks-skill"
import { createQueryCalendarSkill } from "@/application/use-cases/agent/query-calendar-skill"
import { createCompleteTaskSkill } from "@/application/use-cases/agent/complete-task-skill"
import { createPlannerSkill } from "@/application/use-cases/agent/planner-skill"
import { createAdjustTagsSkill } from "@/application/use-cases/agent/adjust-tags-skill"

describe("Agent skill trigger policy", () => {
  it("keeps fast triggers only for explicit brain-dump and reorganize skills", () => {
    const brainDump = createBrainDumpSkill("user-1") as unknown as { triggers?: string[] }
    const reorganize = createReorganizeSkill("user-1") as unknown as { triggers?: string[] }
    const queryTasks = createQueryTasksSkill("user-1") as unknown as { triggers?: string[] }
    const queryCalendar = createQueryCalendarSkill("user-1") as unknown as { triggers?: string[] }
    const completeTask = createCompleteTaskSkill("user-1") as unknown as { triggers?: string[] }
    const planner = createPlannerSkill("user-1") as unknown as { triggers?: string[] }
    const adjustTags = createAdjustTagsSkill("user-1") as unknown as { triggers?: string[] }

    expect(brainDump.triggers ?? []).toEqual(["記錄", "幫我記", "記一下", "待辦", "todo"])
    expect(reorganize.triggers ?? []).toEqual(["幫我整理", "整理任務", "整理待辦", "重組任務", "重整結構"])
    expect((brainDump.triggers ?? []).length).toBeLessThanOrEqual(5)
    expect((reorganize.triggers ?? []).length).toBeLessThanOrEqual(5)

    expect(queryTasks.triggers ?? []).toEqual([])
    expect(queryCalendar.triggers ?? []).toEqual([])
    expect(completeTask.triggers ?? []).toEqual([])
    expect(planner.triggers ?? []).toEqual([])
    expect(adjustTags.triggers ?? []).toEqual([])
  })
})
