/**
 * GET /api/tasks/[taskId]/events
 *
 * 查詢任務關聯的所有會議
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "events": [
 *       {
 *         "id": "uuid",
 *         "calendar_event_id": "abc123",
 *         "summary": "客戶需求討論",
 *         "description": "討論新功能的技術規格",
 *         "start_date_time": "2026-02-12T14:00:00Z",
 *         "end_date_time": "2026-02-12T15:00:00Z",
 *         "meet_link": "https://meet.google.com/abc-defg-hij",
 *         "event_link": "https://calendar.google.com/event?eid=...",
 *         "attendees": ["client@example.com"],
 *         "created_at": "2026-02-08T03:00:00Z"
 *       }
 *     ]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    // 認證
    const userId = await authenticateRequest(request, prisma)

    // 解析參數
    const { taskId } = await params

    if (!taskId) {
      throw new ValidationException('Missing taskId', 'taskId')
    }

    // 驗證任務是否屬於該用戶
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        user_id: userId,
        deleted_at: null,
      },
    })

    if (!task) {
      throw new ValidationException('Task not found', 'taskId')
    }

    // 查詢任務的所有會議（未刪除的）
    const events = await prisma.calendarEvent.findMany({
      where: {
        task_id: taskId,
        user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        start_date_time: 'asc',
      },
    })

    // 轉換為 API 格式（camelCase -> snake_case 已由 Prisma 處理）
    const eventsData = events.map(event => ({
      id: event.id,
      calendar_event_id: event.calendar_event_id,
      summary: event.summary,
      description: event.description,
      start_date_time: event.start_date_time.toISOString(),
      end_date_time: event.end_date_time.toISOString(),
      meet_link: event.meet_link,
      event_link: event.event_link,
      attendees: event.attendees,
      created_at: event.created_at.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        events: eventsData,
      },
    })
  })
}
