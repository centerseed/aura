import { prisma } from "@/lib/db"
import { CreateTaskUseCase } from "@/application/use-cases/tasks/create-task"

export interface CalendarEventTaskLinkInput {
  userId: string
  eventId: string
  title: string
  start: string
  end: string
  eventLink?: string
  meetLink?: string
  description?: string | null
  attendees?: string[]
}

export interface CalendarEventTaskLinkResult {
  taskId: string
  taskTitle: string
}

export async function createTaskFromCalendarEvent(
  input: CalendarEventTaskLinkInput,
): Promise<CalendarEventTaskLinkResult> {
  const createTaskUseCase = new CreateTaskUseCase()
  const narrativeParts = [
    `來自行事曆事件：${input.title}`,
    `時間：${input.start} ~ ${input.end}`,
    input.eventLink ? `Calendar: ${input.eventLink}` : null,
    input.meetLink ? `Meet: ${input.meetLink}` : null,
    input.description?.trim() ? `說明：${input.description.trim()}` : null,
  ].filter((value): value is string => Boolean(value))

  const created = await createTaskUseCase.execute({
    userId: input.userId,
    content: input.title,
    status: "INBOX",
    narrative: narrativeParts.join("\n"),
  })

  await prisma.calendarEvent.upsert({
    where: {
      calendar_event_id: input.eventId,
    },
    create: {
      user_id: input.userId,
      task_id: created.task.id,
      calendar_event_id: input.eventId,
      summary: input.title,
      description: input.description ?? null,
      start_date_time: new Date(input.start),
      end_date_time: new Date(input.end),
      meet_link: input.meetLink ?? null,
      event_link: input.eventLink ?? "",
      attendees: input.attendees ?? [],
    },
    update: {
      task_id: created.task.id,
      summary: input.title,
      description: input.description ?? null,
      start_date_time: new Date(input.start),
      end_date_time: new Date(input.end),
      meet_link: input.meetLink ?? null,
      event_link: input.eventLink ?? "",
      attendees: input.attendees ?? [],
      deleted_at: null,
    },
  })

  return {
    taskId: created.task.id,
    taskTitle: created.task.content,
  }
}
