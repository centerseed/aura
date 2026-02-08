/**
 * POST /api/calendar/webhook
 *
 * Receives Google Calendar Push Notifications.
 * Google sends a POST request when events change on a watched calendar.
 *
 * Headers from Google:
 * - X-Goog-Channel-ID: The channel ID we set when registering
 * - X-Goog-Resource-ID: The resource being watched
 * - X-Goog-Resource-State: "sync" (initial) or "exists" (change)
 */

import { NextRequest, NextResponse } from 'next/server'
import { CalendarSyncService } from '@/lib/calendar-sync-service'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const channelId = request.headers.get('x-goog-channel-id')
    const resourceId = request.headers.get('x-goog-resource-id')
    const resourceState = request.headers.get('x-goog-resource-state')

    if (!channelId || !resourceId) {
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      )
    }

    // Google sends a "sync" notification when watch is first registered
    if (resourceState === 'sync') {
      console.log(`Webhook sync confirmation: channel=${channelId}`)
      return NextResponse.json({ status: 'ok' })
    }

    // Process the notification
    const syncService = new CalendarSyncService(prisma)
    const result = await syncService.handleWebhookNotification(
      channelId,
      resourceId
    )

    if (!result) {
      return NextResponse.json({ status: 'ignored' })
    }

    return NextResponse.json({ status: 'synced', ...result })
  } catch (error) {
    console.error('Webhook processing error:', error)
    // Always return 200 to avoid Google retrying
    return NextResponse.json({ status: 'error' })
  }
}
