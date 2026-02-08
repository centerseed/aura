/**
 * POST /api/calendar/sync
 *
 * Manually trigger a full sync of Google Calendar events.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "created": 2, "updated": 5, "deleted": 1 }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { CalendarSyncService } from '@/lib/calendar-sync-service'
import { prisma } from '@/lib/db'
import { catchDomainException } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)

    const syncService = new CalendarSyncService(prisma)
    const result = await syncService.syncUserEvents(userId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  })
}
