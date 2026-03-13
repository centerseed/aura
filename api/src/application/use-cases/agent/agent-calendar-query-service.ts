import { CalendarService, type CalendarEventSummary } from "@/lib/calendar-service"
import { prisma } from "@/lib/db"
import { getEndOfDay, getStartOfDay, resolveTimezone } from "@/lib/timezone-utils"
import { serializeFactsSummary } from "./tool-result-protocol"

const MAX_DISPLAY_ITEMS = 5

export interface AgentCalendarPresentedEntity {
  position: number
  title: string
  entityId: string
  entityType: "calendar_event"
  start: string
  end: string
  description?: string
  eventLink?: string
  meetLink?: string
  attendees?: string[]
}

export interface AgentCalendarEventItem {
  eventId: string
  title: string
  start: string
  end: string
  description?: string
  eventLink?: string
  meetLink?: string
  attendees?: string[]
  linkedTaskId?: string
  linkedTaskTitle?: string
  isLinkedToTask: boolean
}

export interface AgentCalendarAvailabilityItem {
  start: string
  end: string
  durationMinutes: number
}

export interface AgentCalendarQueryResult {
  queryType: "events" | "availability"
  scopeLabel: string
  timezone: string
  totalCount: number
  truncated: boolean
  events?: AgentCalendarEventItem[]
  availableSlots?: AgentCalendarAvailabilityItem[]
  presentedEntities: AgentCalendarPresentedEntity[]
  summary: string
}

type TimeScopePart = "full_day" | "morning" | "afternoon" | "evening"
type CalendarQueryType = "events" | "availability"

interface ParsedCalendarQuery {
  queryType: CalendarQueryType
  dayOffset?: 0 | 1
  rollingDays?: number
  part: TimeScopePart
  scopeLabel: string
}

export class AgentCalendarQueryService {
  constructor(
    private readonly calendarService: CalendarService = new CalendarService(prisma),
    private readonly timezoneResolver: typeof resolveTimezone = resolveTimezone,
    private readonly calendarEventStore: Pick<typeof prisma.calendarEvent, "findMany"> = prisma.calendarEvent,
  ) {}

  async query(userId: string, rawMessage: string): Promise<AgentCalendarQueryResult> {
    const parsed = parseCalendarQuery(rawMessage)
    const timezone = await this.timezoneResolver(userId)
    const { timeMin, timeMax } = resolveTimeRange(new Date(), timezone, parsed)

    if (parsed.queryType === "availability") {
      const freeBusy = await this.calendarService.queryFreeBusy(userId, timeMin, timeMax, resolveWorkingHours(parsed.part))
      const availableSlots = freeBusy.availableSlots.slice(0, MAX_DISPLAY_ITEMS).map((slot) => ({
        start: slot.start,
        end: slot.end,
        durationMinutes: slot.durationMinutes,
      }))

      return {
        queryType: "availability",
        scopeLabel: parsed.scopeLabel,
        timezone,
        totalCount: freeBusy.availableSlots.length,
        truncated: freeBusy.availableSlots.length > MAX_DISPLAY_ITEMS,
        availableSlots,
        presentedEntities: [],
        summary: formatAvailabilitySummary(parsed.scopeLabel, timezone, availableSlots, freeBusy.availableSlots.length),
      }
    }

    const eventResult = await this.calendarService.queryEvents(userId, timeMin, timeMax)
    const linkedEvents = await this.calendarEventStore.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        calendar_event_id: {
          in: eventResult.events.map((event) => event.eventId),
        },
      },
      select: {
        calendar_event_id: true,
        task_id: true,
        task: {
          select: {
            content: true,
          },
        },
      },
    })
    const linkedEventMap = new Map(
      linkedEvents.map((event) => [event.calendar_event_id, event]),
    )

    const events = eventResult.events.slice(0, MAX_DISPLAY_ITEMS).map((event) => {
      const linked = linkedEventMap.get(event.eventId)
      return {
        eventId: event.eventId,
        title: event.summary,
        start: event.start,
        end: event.end,
        description: event.description,
        eventLink: event.eventLink,
        meetLink: event.meetLink,
        attendees: event.attendees ?? [],
        linkedTaskId: linked?.task_id ?? undefined,
        linkedTaskTitle: linked?.task?.content ?? undefined,
        isLinkedToTask: Boolean(linked?.task_id),
      }
    })

    return {
      queryType: "events",
      scopeLabel: parsed.scopeLabel,
      timezone,
      totalCount: eventResult.events.length,
      truncated: eventResult.events.length > MAX_DISPLAY_ITEMS,
      events,
      presentedEntities: events.map((event, index) => ({
        position: index + 1,
        title: event.title,
        entityId: event.eventId,
        entityType: "calendar_event" as const,
        start: event.start,
        end: event.end,
        description: event.description,
        eventLink: event.eventLink,
        meetLink: event.meetLink,
        attendees: event.attendees,
      })),
      summary: formatEventsSummary(parsed.scopeLabel, timezone, events, eventResult.events.length),
    }
  }
}

export function serializeCalendarQueryToolResult(result: AgentCalendarQueryResult): string {
  return serializeFactsSummary({
    queryType: result.queryType,
    scopeLabel: result.scopeLabel,
    timezone: result.timezone,
    totalCount: result.totalCount,
    truncated: result.truncated,
    events: result.events ?? [],
    availableSlots: result.availableSlots ?? [],
    presentedEntities: result.presentedEntities,
  }, result.summary)
}

function parseCalendarQuery(message: string): ParsedCalendarQuery {
  const rollingDays = /未來\s*(?:三天|3天)/.test(message)
    ? 3
    : /未來\s*(?:兩週|2週|两周|兩周|14天)/.test(message)
      ? 14
      : undefined
  const dayOffset = rollingDays ? undefined : (/明天/.test(message) ? 1 : 0)
  const part = /上午|早上/.test(message)
    ? "morning"
    : /下午/.test(message)
      ? "afternoon"
      : /晚上|晚間/.test(message)
        ? "evening"
        : "full_day"

  const queryType = /有空|空檔|空嗎|有沒有空|available|free/i.test(message)
    ? "availability"
    : "events"

  return {
    queryType,
    dayOffset,
    rollingDays,
    part,
    scopeLabel: formatScopeLabel(dayOffset, part, rollingDays),
  }
}

function formatScopeLabel(dayOffset: 0 | 1 | undefined, part: TimeScopePart, rollingDays?: number): string {
  if (rollingDays === 3) return "未來三天"
  if (rollingDays === 14) return "未來兩週"
  const dayLabel = dayOffset === 1 ? "明天" : "今天"
  if (part === "full_day") return dayLabel
  if (part === "morning") return `${dayLabel}上午`
  if (part === "afternoon") return `${dayLabel}下午`
  return `${dayLabel}晚上`
}

function resolveTimeRange(
  now: Date,
  timezone: string,
  parsed: ParsedCalendarQuery,
): { timeMin: string; timeMax: string } {
  const todayStart = getStartOfDay(now, timezone)
  if (parsed.rollingDays) {
    return {
      timeMin: todayStart.toISOString(),
      timeMax: new Date(todayStart.getTime() + parsed.rollingDays * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const targetDayStart = new Date(todayStart.getTime() + (parsed.dayOffset ?? 0) * 24 * 60 * 60 * 1000)
  const targetDayEnd = new Date(getEndOfDay(targetDayStart, timezone))

  if (parsed.part === "morning") {
    return {
      timeMin: new Date(targetDayStart.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(targetDayStart.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    }
  }

  if (parsed.part === "afternoon") {
    return {
      timeMin: new Date(targetDayStart.getTime() + 13 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(targetDayStart.getTime() + 18 * 60 * 60 * 1000).toISOString(),
    }
  }

  if (parsed.part === "evening") {
    return {
      timeMin: new Date(targetDayStart.getTime() + 18 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(targetDayStart.getTime() + 22 * 60 * 60 * 1000).toISOString(),
    }
  }

  return {
    timeMin: targetDayStart.toISOString(),
    timeMax: targetDayEnd.toISOString(),
  }
}

function resolveWorkingHours(part: TimeScopePart): { start: number; end: number } {
  if (part === "morning") return { start: 9, end: 12 }
  if (part === "afternoon") return { start: 13, end: 18 }
  if (part === "evening") return { start: 18, end: 22 }
  return { start: 9, end: 22 }
}

function formatEventsSummary(
  scopeLabel: string,
  timezone: string,
  events: AgentCalendarEventItem[],
  totalCount: number,
): string {
  if (totalCount === 0) {
    return `${scopeLabel}目前沒有查到行程或會議。`
  }

  const header = totalCount > events.length
    ? `📅 ${scopeLabel}共有 ${totalCount} 個行程，我先列出 ${events.length} 個：`
    : `📅 ${scopeLabel}共有 ${totalCount} 個行程：`

  const items = events.map((event, index) =>
    `${index + 1}. ${formatEventTimeRange(scopeLabel, event.start, event.end, timezone)} ${event.title}${event.isLinkedToTask ? `｜已連結：${event.linkedTaskTitle}` : "｜未連結任務"}`,
  )

  const unlinkedEvents = events.filter((event) => !event.isLinkedToTask)
  const guidance = unlinkedEvents.length > 0
    ? [
        "",
        `如果你要，我可以把未連結的行程轉成 Zentropy 任務。直接回覆「把第 ${unlinkedEvents[0] === events[0] ? 1 : events.findIndex((event) => !event.isLinkedToTask) + 1} 個加到任務」。`,
      ]
    : []

  return [header, "", ...items, ...guidance].join("\n")
}

function formatAvailabilitySummary(
  scopeLabel: string,
  timezone: string,
  availableSlots: AgentCalendarAvailabilityItem[],
  totalCount: number,
): string {
  if (totalCount === 0) {
    return `⏳ ${scopeLabel}目前沒有查到可用空檔。`
  }

  const header = totalCount > availableSlots.length
    ? `⏳ ${scopeLabel}共有 ${totalCount} 段可用空檔，我先列出 ${availableSlots.length} 段：`
    : `⏳ ${scopeLabel}共有 ${totalCount} 段可用空檔：`

  const items = availableSlots.map((slot, index) =>
    `${index + 1}. ${formatTimeRange(slot.start, slot.end, timezone)}（${slot.durationMinutes} 分鐘）`,
  )

  return [header, "", ...items].join("\n")
}

function formatTimeRange(start: string, end: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${formatter.format(new Date(start))}-${formatter.format(new Date(end))}`
}

function formatEventTimeRange(
  scopeLabel: string,
  start: string,
  end: string,
  timezone: string,
): string {
  const timeRange = formatTimeRange(start, end, timezone)

  if (!/未來三天|未來兩週/u.test(scopeLabel)) {
    return timeRange
  }

  const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
  })

  return `${dateFormatter.format(new Date(start))} ${timeRange}`
}

export function isCalendarNotConnectedError(error: unknown): boolean {
  return error instanceof Error && /Google Calendar not connected/i.test(error.message)
}

export function toCalendarUnavailableMessage(error: unknown): string | null {
  if (!isCalendarNotConnectedError(error)) return null
  return "你還沒有連接 Google Calendar，所以我目前沒辦法幫你查會議或空檔。"
}

export function toEventItems(events: CalendarEventSummary[]): AgentCalendarEventItem[] {
  return events.map((event) => ({
    eventId: event.eventId,
    title: event.summary,
    start: event.start,
    end: event.end,
    eventLink: event.eventLink,
    meetLink: event.meetLink,
    attendees: event.attendees ?? [],
    isLinkedToTask: false,
  }))
}
