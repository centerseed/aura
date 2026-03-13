import { describe, expect, it, vi } from "vitest"
import { AgentCalendarQueryService } from "@/application/use-cases/agent/agent-calendar-query-service"

describe("AgentCalendarQueryService", () => {
  it("includes month/day for rolling multi-day event queries", async () => {
    const service = new AgentCalendarQueryService(
      {
        queryEvents: vi.fn().mockResolvedValue({
          events: [
            {
              eventId: "event-1",
              summary: "好時光日記",
              start: "2026-03-14T11:00:00.000Z",
              end: "2026-03-14T11:30:00.000Z",
            },
            {
              eventId: "event-2",
              summary: "體驗脈輪儀器",
              start: "2026-03-15T22:00:00.000Z",
              end: "2026-03-15T23:00:00.000Z",
            },
          ],
          timeMin: "2026-03-13T00:00:00.000Z",
          timeMax: "2026-03-27T00:00:00.000Z",
          timezone: "Asia/Tokyo",
        }),
        queryFreeBusy: vi.fn(),
      } as never,
      vi.fn().mockResolvedValue("Asia/Tokyo"),
      {
        findMany: vi.fn().mockResolvedValue([
          {
            calendar_event_id: "event-2",
            task_id: "task-2",
            task: { content: "體驗脈輪儀器" },
          },
        ]),
      },
    )

    const result = await service.query("user-1", "幫我看未來兩週有什麼行程")

    expect(result.summary).toContain("03/14 20:00-20:30 好時光日記｜未連結任務")
    expect(result.summary).toContain("03/16 07:00-08:00 體驗脈輪儀器｜已連結：體驗脈輪儀器")
  })

  it("keeps single-day event queries time-only", async () => {
    const service = new AgentCalendarQueryService(
      {
        queryEvents: vi.fn().mockResolvedValue({
          events: [
            {
              eventId: "event-1",
              summary: "客戶會議",
              start: "2026-03-14T01:00:00.000Z",
              end: "2026-03-14T02:00:00.000Z",
            },
          ],
          timeMin: "2026-03-14T00:00:00.000Z",
          timeMax: "2026-03-15T00:00:00.000Z",
          timezone: "Asia/Tokyo",
        }),
        queryFreeBusy: vi.fn(),
      } as never,
      vi.fn().mockResolvedValue("Asia/Tokyo"),
      {
        findMany: vi.fn().mockResolvedValue([]),
      },
    )

    const result = await service.query("user-1", "我明天有什麼會議？")

    expect(result.summary).toContain("10:00-11:00 客戶會議｜未連結任務")
    expect(result.summary).not.toContain("03/")
  })
})
