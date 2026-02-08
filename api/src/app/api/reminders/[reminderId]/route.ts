/**
 * GET /api/reminders/[reminderId] - 查詢單一提醒
 * PUT /api/reminders/[reminderId] - 更新提醒
 * DELETE /api/reminders/[reminderId] - 刪除提醒
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { CalendarService } from '@/lib/calendar-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException, NotFoundException } from '@/lib/api-response'

type RouteContext = { params: Promise<{ reminderId: string }> }

function formatReminder(r: any) {
  return {
    id: r.id,
    taskId: r.task_id,
    calendarEventId: r.calendar_event_id,
    remindAt: r.remind_at.toISOString(),
    message: r.message,
    reminderType: r.reminder_type,
    calendarRemindEventId: r.calendar_remind_event_id,
    createdAt: r.created_at.toISOString(),
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { reminderId } = await context.params

    const reminder = await prisma.reminderConfig.findFirst({
      where: { id: reminderId, user_id: userId, deleted_at: null },
    })

    if (!reminder) {
      throw new NotFoundException('Reminder')
    }

    return NextResponse.json({
      success: true,
      data: formatReminder(reminder),
    })
  })
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { reminderId } = await context.params

    const reminder = await prisma.reminderConfig.findFirst({
      where: { id: reminderId, user_id: userId, deleted_at: null },
    })

    if (!reminder) {
      throw new NotFoundException('Reminder')
    }

    const body = await request.json() as {
      remindAt?: string
      message?: string
    }

    if (!body.remindAt && body.message === undefined) {
      throw new ValidationException('At least one field (remindAt, message) is required')
    }

    const updateData: any = {}

    if (body.remindAt) {
      const remindAtDate = new Date(body.remindAt)
      if (isNaN(remindAtDate.getTime())) {
        throw new ValidationException('Invalid remindAt format', 'remindAt')
      }
      updateData.remind_at = remindAtDate
    }

    if (body.message !== undefined) {
      updateData.message = body.message || null
    }

    // 如果是 Calendar Reminder 且時間變了，需要更新 Google Calendar 事件
    if (body.remindAt && reminder.reminder_type === 'CALENDAR_REMINDER' && reminder.calendar_remind_event_id) {
      const calendarService = new CalendarService(prisma)

      // 刪除舊的 Calendar 事件
      await calendarService.deleteCalendarReminder(userId, reminder.calendar_remind_event_id)

      // 取得 task title
      let taskTitle = '任務提醒'
      if (reminder.task_id) {
        const task = await prisma.task.findFirst({
          where: { id: reminder.task_id },
          select: { content: true },
        })
        if (task) taskTitle = task.content
      }

      // 創建新的 Calendar 事件
      const result = await calendarService.createCalendarReminder(userId, {
        taskTitle,
        remindAt: body.remindAt,
        message: body.message ?? reminder.message ?? undefined,
      })
      updateData.calendar_remind_event_id = result.calendarEventId
    }

    const updated = await prisma.reminderConfig.update({
      where: { id: reminderId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: formatReminder(updated),
    })
  })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { reminderId } = await context.params

    const reminder = await prisma.reminderConfig.findFirst({
      where: { id: reminderId, user_id: userId, deleted_at: null },
    })

    if (!reminder) {
      throw new NotFoundException('Reminder')
    }

    // 如果是 Calendar Reminder，同時刪除 Google Calendar 事件
    if (reminder.reminder_type === 'CALENDAR_REMINDER' && reminder.calendar_remind_event_id) {
      try {
        const calendarService = new CalendarService(prisma)
        await calendarService.deleteCalendarReminder(userId, reminder.calendar_remind_event_id)
      } catch (error) {
        console.warn('Failed to delete calendar reminder event:', error)
        // 不阻斷刪除流程
      }
    }

    // 軟刪除
    await prisma.reminderConfig.update({
      where: { id: reminderId },
      data: { deleted_at: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: { deleted: true, id: reminderId },
    })
  })
}
