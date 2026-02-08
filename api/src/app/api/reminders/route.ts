/**
 * POST /api/reminders - 創建提醒
 * GET /api/reminders - 查詢提醒列表
 *
 * POST Request Body:
 * {
 *   "taskId": "task-uuid",           // 可選，關聯的任務
 *   "calendarEventId": "ce-uuid",    // 可選，關聯的會議（DB UUID）
 *   "remindAt": "2026-02-15T08:00:00+08:00",  // 必填
 *   "message": "記得帶筆電",          // 可選
 *   "reminderType": "CALENDAR_REMINDER"  // 必填：CALENDAR_REMINDER | LOCAL_NOTIFICATION
 * }
 *
 * GET Query Params:
 *   ?taskId=xxx       - 查詢特定任務的提醒
 *   ?type=CALENDAR_REMINDER - 篩選提醒類型
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { CalendarService } from '@/lib/calendar-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const body = await request.json() as {
      taskId?: string
      calendarEventId?: string
      remindAt?: string
      message?: string
      reminderType?: string
    }

    const { taskId, calendarEventId, remindAt, message, reminderType } = body

    // 驗證必填
    if (!remindAt) {
      throw new ValidationException('Missing remindAt', 'remindAt')
    }
    if (!reminderType) {
      throw new ValidationException('Missing reminderType', 'reminderType')
    }
    if (reminderType !== 'CALENDAR_REMINDER' && reminderType !== 'LOCAL_NOTIFICATION') {
      throw new ValidationException(
        'reminderType must be CALENDAR_REMINDER or LOCAL_NOTIFICATION',
        'reminderType'
      )
    }

    // 驗證時間
    const remindAtDate = new Date(remindAt)
    if (isNaN(remindAtDate.getTime())) {
      throw new ValidationException('Invalid remindAt format', 'remindAt')
    }

    // 驗證關聯 task 是否屬於該用戶
    let taskTitle = '任務提醒'
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, user_id: userId, deleted_at: null },
      })
      if (!task) {
        throw new ValidationException('Task not found', 'taskId')
      }
      taskTitle = task.content
    }

    // 驗證關聯 calendarEvent 是否屬於該用戶
    if (calendarEventId) {
      const event = await prisma.calendarEvent.findFirst({
        where: { id: calendarEventId, user_id: userId, deleted_at: null },
      })
      if (!event) {
        throw new ValidationException('Calendar event not found', 'calendarEventId')
      }
    }

    // 如果是 Calendar Reminder，在 Google Calendar 創建提醒事件
    let calendarRemindEventId: string | null = null
    if (reminderType === 'CALENDAR_REMINDER') {
      const calendarService = new CalendarService(prisma)
      const result = await calendarService.createCalendarReminder(userId, {
        taskTitle,
        remindAt,
        message,
      })
      calendarRemindEventId = result.calendarEventId
    }

    // 儲存到資料庫
    const reminder = await prisma.reminderConfig.create({
      data: {
        user_id: userId,
        task_id: taskId || null,
        calendar_event_id: calendarEventId || null,
        remind_at: remindAtDate,
        message: message || null,
        reminder_type: reminderType as any,
        calendar_remind_event_id: calendarRemindEventId,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: reminder.id,
        taskId: reminder.task_id,
        calendarEventId: reminder.calendar_event_id,
        remindAt: reminder.remind_at.toISOString(),
        message: reminder.message,
        reminderType: reminder.reminder_type,
        calendarRemindEventId: reminder.calendar_remind_event_id,
        createdAt: reminder.created_at.toISOString(),
      },
    })
  })
}

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const type = searchParams.get('type')

    const where: any = {
      user_id: userId,
      deleted_at: null,
    }

    if (taskId) {
      where.task_id = taskId
    }

    if (type) {
      where.reminder_type = type
    }

    const reminders = await prisma.reminderConfig.findMany({
      where,
      orderBy: { remind_at: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: reminders.map(r => ({
        id: r.id,
        taskId: r.task_id,
        calendarEventId: r.calendar_event_id,
        remindAt: r.remind_at.toISOString(),
        message: r.message,
        reminderType: r.reminder_type,
        calendarRemindEventId: r.calendar_remind_event_id,
        createdAt: r.created_at.toISOString(),
      })),
    })
  })
}
