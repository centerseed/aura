/**
 * POST /api/calendar/create-event
 *
 * 創建 Google Calendar 會議（自動生成 Google Meet 連結）
 *
 * Request Body:
 * {
 *   "summary": "客戶需求討論",
 *   "description": "討論新功能的技術規格",
 *   "startDateTime": "2026-02-12T14:00:00+08:00",
 *   "endDateTime": "2026-02-12T15:00:00+08:00",
 *   "attendees": ["client@example.com"],  // 可選
 *   "generateMeetLink": true,  // 可選，預設 true
 *   "taskId": "task-123"  // 可選，關聯的 Zentropy Task
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "eventId": "abc123",
 *     "eventLink": "https://calendar.google.com/event?eid=...",
 *     "meetLink": "https://meet.google.com/abc-defg-hij",
 *     "summary": "客戶需求討論",
 *     "startDateTime": "2026-02-12T14:00:00+08:00",
 *     "endDateTime": "2026-02-12T15:00:00+08:00"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { CalendarService } from '@/lib/calendar-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    // 認證
    const userId = await authenticateRequest(request, prisma)

    // 解析 Request Body
    const body = await request.json() as {
      summary?: string
      description?: string
      startDateTime?: string
      endDateTime?: string
      attendees?: string[]
      generateMeetLink?: boolean
      taskId?: string
    }

    const {
      summary,
      description,
      startDateTime,
      endDateTime,
      attendees,
      generateMeetLink = true,
      taskId,
    } = body

    // 驗證必填參數
    if (!summary) {
      throw new ValidationException('Missing summary (meeting title)', 'summary')
    }
    if (!startDateTime) {
      throw new ValidationException('Missing startDateTime', 'startDateTime')
    }
    if (!endDateTime) {
      throw new ValidationException('Missing endDateTime', 'endDateTime')
    }

    // 驗證時間格式
    try {
      const start = new Date(startDateTime)
      const end = new Date(endDateTime)

      // 驗證結束時間必須晚於開始時間
      if (end <= start) {
        throw new ValidationException(
          'End time must be after start time',
          'startDateTime/endDateTime'
        )
      }
    } catch (error) {
      if (error instanceof ValidationException) throw error
      throw new ValidationException('Invalid date format', 'startDateTime/endDateTime')
    }

    // 驗證 attendees email 格式
    if (attendees && attendees.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      for (const email of attendees) {
        if (!emailRegex.test(email)) {
          throw new ValidationException(`Invalid email format: ${email}`, 'attendees')
        }
      }
    }

    // 調用 Calendar Service
    const calendarService = new CalendarService(prisma)
    const result = await calendarService.createEvent(userId, {
      summary,
      description,
      startDateTime,
      endDateTime,
      attendees,
      generateMeetLink,
      taskId,
    })

    console.log(`✅ Event created successfully:`, result)

    return NextResponse.json({
      success: true,
      data: result,
    })
  })
}
