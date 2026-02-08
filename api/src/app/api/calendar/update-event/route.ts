/**
 * PUT /api/calendar/update-event
 *
 * 更新 Google Calendar 會議
 *
 * Request Body:
 * {
 *   "eventId": "abc123",
 *   "summary": "更新的會議標題",  // 可選
 *   "description": "更新的會議備註",  // 可選
 *   "startDateTime": "2026-02-12T15:00:00+08:00",  // 可選
 *   "endDateTime": "2026-02-12T16:00:00+08:00",  // 可選
 *   "attendees": ["new@example.com"]  // 可選
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { CalendarService } from '@/lib/calendar-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function PUT(request: NextRequest) {
  return catchDomainException(async () => {
    // 認證
    const userId = await authenticateRequest(request, prisma)

    // 解析 Request Body
    const body = await request.json() as {
      eventId?: string
      summary?: string
      description?: string
      startDateTime?: string
      endDateTime?: string
      attendees?: string[]
    }

    const { eventId, summary, description, startDateTime, endDateTime, attendees } = body

    // 驗證必填參數
    if (!eventId) {
      throw new ValidationException('Missing eventId', 'eventId')
    }

    // 驗證至少提供一個要更新的欄位
    if (!summary && !description && !startDateTime && !endDateTime && !attendees) {
      throw new ValidationException(
        'At least one field to update is required',
        'summary/description/startDateTime/endDateTime/attendees'
      )
    }

    // 驗證時間格式
    if (startDateTime || endDateTime) {
      try {
        if (startDateTime && endDateTime) {
          const start = new Date(startDateTime)
          const end = new Date(endDateTime)

          // 驗證結束時間必須晚於開始時間
          if (end <= start) {
            throw new ValidationException(
              'End time must be after start time',
              'startDateTime/endDateTime'
            )
          }
        }
      } catch (error) {
        if (error instanceof ValidationException) throw error
        throw new ValidationException('Invalid date format', 'startDateTime/endDateTime')
      }
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
    const result = await calendarService.updateEvent(userId, eventId, {
      summary,
      description,
      startDateTime,
      endDateTime,
      attendees,
    })

    console.log(`✅ Event updated successfully:`, result)

    return NextResponse.json({
      success: true,
      data: result,
    })
  })
}
