/**
 * Calendar Sync Service
 *
 * Handles bidirectional sync between Zentropy and Google Calendar:
 * - Webhook processing (Google → Zentropy)
 * - Full sync (manual trigger)
 * - Watch channel management
 */

import { PrismaClient } from '@prisma/client'
import { OAuthService } from './oauth-service'

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

export interface SyncResult {
  created: number
  updated: number
  deleted: number
}

export class CalendarSyncService {
  private oauthService: OAuthService

  constructor(private prisma: PrismaClient) {
    this.oauthService = new OAuthService(prisma)
  }

  /**
   * 取得使用者的 Access Token
   */
  private async getAccessToken(userId: string): Promise<string> {
    const accessToken = await this.oauthService.getAccessToken(
      userId,
      'GOOGLE_CALENDAR'
    )
    if (!accessToken) {
      throw new Error('Google Calendar not connected')
    }
    return accessToken
  }

  /**
   * 註冊 Google Calendar Push Notification Watch Channel
   *
   * @param userId - Zentropy User ID
   * @param webhookUrl - 接收 webhook 的 URL
   * @returns Watch channel info
   */
  async registerWatch(
    userId: string,
    webhookUrl: string
  ): Promise<{ channelId: string; resourceId: string; expiration: string }> {
    const accessToken = await this.getAccessToken(userId)
    const channelId = `zentropy-${userId}-${Date.now()}`

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: process.env.CALENDAR_WEBHOOK_SECRET || '',
          params: {
            ttl: '604800', // 7 days in seconds
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to register watch: ${error}`)
    }

    const data = (await response.json()) as {
      id: string
      resourceId: string
      expiration: string
    }

    console.log(`Watch registered for user ${userId}: channel=${data.id}`)

    return {
      channelId: data.id,
      resourceId: data.resourceId,
      expiration: data.expiration,
    }
  }

  /**
   * 停止 Watch Channel
   */
  async stopWatch(
    userId: string,
    channelId: string,
    resourceId: string
  ): Promise<void> {
    const accessToken = await this.getAccessToken(userId)

    const response = await fetch(
      `${CALENDAR_API_BASE}/channels/stop`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          resourceId,
        }),
      }
    )

    // 404 means channel already expired
    if (!response.ok && response.status !== 404) {
      const error = await response.text()
      throw new Error(`Failed to stop watch: ${error}`)
    }
  }

  /**
   * 處理 Google Calendar Webhook 通知
   *
   * Google Calendar 的 webhook 只通知「有變更」，不包含具體變更內容。
   * 需要自行呼叫 Events.list 取得最新事件。
   */
  async handleWebhookNotification(
    channelId: string,
    resourceId: string
  ): Promise<SyncResult | null> {
    // 從 channelId 解析 userId
    const match = channelId.match(/^zentropy-(.+)-\d+$/)
    if (!match) {
      console.warn(`Unknown channel ID format: ${channelId}`)
      return null
    }

    const userId = match[1]
    return await this.syncUserEvents(userId)
  }

  /**
   * 全量同步使用者的 Google Calendar 事件
   *
   * 策略：Google Calendar 為 source of truth
   */
  async syncUserEvents(userId: string): Promise<SyncResult> {
    const accessToken = await this.getAccessToken(userId)
    const result: SyncResult = { created: 0, updated: 0, deleted: 0 }

    // 取得最近 30 天的事件
    const timeMin = new Date()
    timeMin.setDate(timeMin.getDate() - 7)
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 30)

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?` +
        new URLSearchParams({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list events: ${error}`)
    }

    const data = (await response.json()) as {
      items?: Array<{
        id: string
        status: string
        summary?: string
        description?: string
        start?: { dateTime?: string; date?: string }
        end?: { dateTime?: string; date?: string }
        htmlLink?: string
        hangoutLink?: string
        conferenceData?: { entryPoints?: Array<{ uri?: string }> }
      }>
    }

    const googleEvents = data.items || []

    // 取得本地事件（未刪除的）
    const localEvents = await this.prisma.calendarEvent.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
    })

    const localEventMap = new Map(
      localEvents.map((e) => [e.calendar_event_id, e])
    )

    // 同步 Google → Local
    for (const gEvent of googleEvents) {
      if (!gEvent.start?.dateTime || !gEvent.end?.dateTime) continue // Skip all-day events

      const localEvent = localEventMap.get(gEvent.id)

      if (gEvent.status === 'cancelled') {
        // 事件被刪除
        if (localEvent) {
          await this.prisma.calendarEvent.update({
            where: { id: localEvent.id },
            data: { deleted_at: new Date() },
          })
          result.deleted++
        }
        continue
      }

      const meetLink =
        gEvent.hangoutLink ||
        gEvent.conferenceData?.entryPoints?.[0]?.uri ||
        null

      if (localEvent) {
        // 更新既有事件
        await this.prisma.calendarEvent.update({
          where: { id: localEvent.id },
          data: {
            summary: gEvent.summary || localEvent.summary,
            description: gEvent.description || null,
            start_date_time: new Date(gEvent.start.dateTime),
            end_date_time: new Date(gEvent.end.dateTime),
            meet_link: meetLink,
            event_link: gEvent.htmlLink || localEvent.event_link,
          },
        })
        result.updated++
      } else {
        // 建立新事件（只同步有 Zentropy 標記的事件）
        const isZentropyEvent =
          gEvent.description?.includes('[Zentropy Task:') ||
          gEvent.summary?.startsWith('🔔 提醒：')

        if (isZentropyEvent) {
          // 從 description 解析 taskId
          const taskIdMatch = gEvent.description?.match(
            /\[Zentropy Task: ([^\]]+)\]/
          )
          const taskId = taskIdMatch?.[1] || null

          await this.prisma.calendarEvent.create({
            data: {
              user_id: userId,
              task_id: taskId,
              calendar_event_id: gEvent.id,
              summary: gEvent.summary || 'Untitled',
              description: gEvent.description || null,
              start_date_time: new Date(gEvent.start.dateTime),
              end_date_time: new Date(gEvent.end.dateTime),
              meet_link: meetLink,
              event_link: gEvent.htmlLink || '',
            },
          })
          result.created++
        }
      }

      localEventMap.delete(gEvent.id)
    }

    console.log(
      `Sync complete for user ${userId}: created=${result.created}, updated=${result.updated}, deleted=${result.deleted}`
    )

    return result
  }
}
