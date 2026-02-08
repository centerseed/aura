/**
 * POST /api/calendar/free-busy
 *
 * 查詢 Google Calendar 空檔時間
 *
 * Request Body:
 * {
 *   "timeMin": "2026-02-10T00:00:00+08:00",  // 查詢起始時間
 *   "timeMax": "2026-02-17T00:00:00+08:00",  // 查詢結束時間
 *   "workingHours": { "start": 9, "end": 18 }  // 可選，工作時間
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "availableSlots": [
 *       {
 *         "start": "2026-02-12T14:00:00+08:00",
 *         "end": "2026-02-12T15:00:00+08:00",
 *         "durationMinutes": 60
 *       }
 *     ],
 *     "busySlots": [
 *       {
 *         "start": "2026-02-12T10:00:00+08:00",
 *         "end": "2026-02-12T11:00:00+08:00",
 *         "summary": "團隊週會"
 *       }
 *     ],
 *     "timeMin": "2026-02-10T00:00:00+08:00",
 *     "timeMax": "2026-02-17T00:00:00+08:00"
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
      timeMin?: string
      timeMax?: string
      workingHours?: { start: number; end: number }
    }

    const { timeMin, timeMax, workingHours } = body

    // 驗證必填參數
    if (!timeMin) {
      throw new ValidationException('Missing timeMin parameter', 'timeMin')
    }
    if (!timeMax) {
      throw new ValidationException('Missing timeMax parameter', 'timeMax')
    }

    // 驗證時間格式
    try {
      new Date(timeMin)
      new Date(timeMax)
    } catch (error) {
      throw new ValidationException('Invalid date format', 'timeMin/timeMax')
    }

    // 調用 Calendar Service
    const calendarService = new CalendarService(prisma)
    const result = await calendarService.queryFreeBusy(
      userId,
      timeMin,
      timeMax,
      workingHours
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  })
}
