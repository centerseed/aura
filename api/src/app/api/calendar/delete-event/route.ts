/**
 * DELETE /api/calendar/delete-event
 *
 * 刪除 Google Calendar 事件
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { CalendarService } from '@/lib/calendar-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function DELETE(request: NextRequest) {
  return catchDomainException(async () => {
    // 認證
    const userId = await authenticateRequest(request, prisma)

    // 解析請求參數
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // 驗證必填參數
    if (!eventId) {
      throw new ValidationException('Missing required parameter: eventId', 'eventId')
    }

    // 刪除事件
    const calendarService = new CalendarService(prisma)

    await calendarService.deleteEvent(userId, eventId)

    return NextResponse.json({
      success: true,
      data: {
        eventId,
        deleted: true,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    })
  })
}
