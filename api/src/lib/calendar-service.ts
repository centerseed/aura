/**
 * Google Calendar Service
 *
 * 封裝 Google Calendar API 調用，提供：
 * - Free/Busy 查詢（查看可用時間）
 * - Event 創建（創建會議 + Google Meet 連結）
 */

import { PrismaClient } from '@prisma/client'
import { OAuthService } from './oauth-service'

// Google Calendar API Endpoints
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

/**
 * 時間段類型
 */
export interface TimeSlot {
  start: string  // ISO 8601 format
  end: string
}

/**
 * 可用時段（包含時長）
 */
export interface AvailableSlot extends TimeSlot {
  durationMinutes: number
}

/**
 * 已佔用時段（包含會議標題）
 */
export interface BusySlot extends TimeSlot {
  summary?: string
}

export interface CalendarEventSummary extends TimeSlot {
  eventId: string
  summary: string
  description?: string
  eventLink?: string
  meetLink?: string
  attendees?: string[]
}

/**
 * Free/Busy 查詢結果
 */
export interface FreeBusyResult {
  availableSlots: AvailableSlot[]
  busySlots: BusySlot[]
  timeMin: string
  timeMax: string
}

export interface QueryEventsResult {
  events: CalendarEventSummary[]
  timeMin: string
  timeMax: string
  timezone: string
}

/**
 * 創建會議的輸入參數
 */
export interface CreateEventInput {
  summary: string
  description?: string
  startDateTime: string  // ISO 8601
  endDateTime: string
  attendees?: string[]  // Email addresses
  generateMeetLink?: boolean
  taskId?: string  // 關聯的 Zentropy Task ID
}

/**
 * 創建會議的結果
 */
export interface CreateEventResult {
  eventId: string
  eventLink: string  // Google Calendar 事件連結
  meetLink?: string  // Google Meet 連結
  summary: string
  startDateTime: string
  endDateTime: string
}

/**
 * Calendar Service Class
 */
export class CalendarService {
  private oauthService: OAuthService

  constructor(private prisma: PrismaClient) {
    this.oauthService = new OAuthService(prisma)
  }

  /**
   * 獲取使用者的 OAuth Access Token（自動刷新如果過期）
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
   * 獲取使用者的時區設定
   */
  private async getUserTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    })
    return user?.timezone || 'Asia/Taipei'
  }

  /**
   * 查詢 Free/Busy 時段
   *
   * @param userId - Zentropy User ID
   * @param timeMin - 查詢起始時間（ISO 8601）
   * @param timeMax - 查詢結束時間（ISO 8601）
   * @param workingHours - 工作時間（預設 9:00-18:00）
   */
  async queryFreeBusy(
    userId: string,
    timeMin: string,
    timeMax: string,
    workingHours = { start: 9, end: 18 }
  ): Promise<FreeBusyResult> {
    const accessToken = await this.getAccessToken(userId)

    // 調用 Google Calendar API - FreeBusy Query
    const response = await fetch(`${CALENDAR_API_BASE}/freeBusy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],  // 查詢主日曆
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to query free/busy: ${error}`)
    }

    const data = await response.json() as {
      calendars?: {
        primary?: {
          busy?: BusySlot[]
        }
      }
    }
    const busySlots: BusySlot[] = data.calendars?.primary?.busy || []

    // 計算可用時段（在工作時間內且不在 busy slots 中）
    const availableSlots = this.calculateAvailableSlots(
      timeMin,
      timeMax,
      busySlots,
      workingHours
    )

    return {
      availableSlots,
      busySlots,
      timeMin,
      timeMax,
    }
  }

  /**
   * 查詢指定時間範圍內的 Calendar Events
   */
  async queryEvents(
    userId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<QueryEventsResult> {
    const accessToken = await this.getAccessToken(userId)
    const timezone = await this.getUserTimezone(userId)

    const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '50')

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list events: ${error}`)
    }

    const data = await response.json() as {
      items?: Array<{
        id: string
        summary?: string
        description?: string
        htmlLink?: string
        hangoutLink?: string
        conferenceData?: { entryPoints?: Array<{ uri?: string }> }
        attendees?: Array<{ email?: string }>
        start?: { dateTime?: string; date?: string }
        end?: { dateTime?: string; date?: string }
      }>
    }

    const events = (data.items || [])
      .filter((item) => item.start?.dateTime && item.end?.dateTime)
      .map((item) => ({
        eventId: item.id,
        summary: item.summary || '未命名行程',
        description: item.description || undefined,
        start: item.start!.dateTime!,
        end: item.end!.dateTime!,
        eventLink: item.htmlLink,
        meetLink: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri,
        attendees: Array.isArray(item.attendees)
          ? item.attendees
            .map((attendee) => attendee.email?.trim())
            .filter((email): email is string => Boolean(email))
          : [],
      }))

    return {
      events,
      timeMin,
      timeMax,
      timezone,
    }
  }

  /**
   * 創建 Calendar Event（會議）
   *
   * @param userId - Zentropy User ID
   * @param input - 會議資訊
   */
  async createEvent(
    userId: string,
    input: CreateEventInput
  ): Promise<CreateEventResult> {
    const accessToken = await this.getAccessToken(userId)
    const timezone = await this.getUserTimezone(userId)

    // 準備 Event 資料
    const eventData: any = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startDateTime,
        timeZone: timezone,
      },
      end: {
        dateTime: input.endDateTime,
        timeZone: timezone,
      },
    }

    // 添加參與者
    if (input.attendees && input.attendees.length > 0) {
      eventData.attendees = input.attendees.map(email => ({ email }))
    }

    // 如果需要生成 Google Meet 連結
    if (input.generateMeetLink) {
      eventData.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    // 如果有關聯 Task，加入 description
    if (input.taskId) {
      const taskNote = `\n\n[Zentropy Task: ${input.taskId}]`
      eventData.description = (eventData.description || '') + taskNote
    }

    // 調用 Google Calendar API - Create Event
    const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`)
    if (input.generateMeetLink) {
      url.searchParams.append('conferenceDataVersion', '1')
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create event: ${error}`)
    }

    const event = await response.json() as {
      id: string
      htmlLink: string
      hangoutLink?: string
      conferenceData?: {
        entryPoints?: Array<{ uri?: string }>
      }
      summary: string
      start: { dateTime: string }
      end: { dateTime: string }
    }

    // 儲存 Event 到 Zentropy 資料庫
    await this.saveEventToDatabase(userId, input.taskId, event, input.attendees)

    return {
      eventId: event.id,
      eventLink: event.htmlLink,
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      summary: event.summary,
      startDateTime: event.start.dateTime,
      endDateTime: event.end.dateTime,
    }
  }

  /**
   * 更新 Calendar Event（會議）
   *
   * @param userId - Zentropy User ID
   * @param eventId - Google Calendar Event ID
   * @param updates - 要更新的欄位
   */
  async updateEvent(
    userId: string,
    eventId: string,
    updates: {
      summary?: string
      description?: string
      startDateTime?: string
      endDateTime?: string
      attendees?: string[]
    }
  ): Promise<CreateEventResult> {
    const accessToken = await this.getAccessToken(userId)
    const timezone = await this.getUserTimezone(userId)

    // 先獲取現有 Event
    const getResponse = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!getResponse.ok) {
      const error = await getResponse.text()
      throw new Error(`Failed to get event: ${error}`)
    }

    const existingEvent = await getResponse.json() as any

    // 準備更新的資料（只更新提供的欄位）
    const updatedEvent: any = {
      ...existingEvent,
    }

    if (updates.summary !== undefined) {
      updatedEvent.summary = updates.summary
    }

    if (updates.description !== undefined) {
      updatedEvent.description = updates.description
    }

    if (updates.startDateTime !== undefined) {
      updatedEvent.start = {
        dateTime: updates.startDateTime,
        timeZone: timezone,
      }
    }

    if (updates.endDateTime !== undefined) {
      updatedEvent.end = {
        dateTime: updates.endDateTime,
        timeZone: timezone,
      }
    }

    if (updates.attendees !== undefined) {
      updatedEvent.attendees = updates.attendees.map(email => ({ email }))
    }

    // 調用 Google Calendar API - Update Event
    const updateResponse = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEvent),
      }
    )

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      throw new Error(`Failed to update event: ${error}`)
    }

    const event = await updateResponse.json() as {
      id: string
      htmlLink: string
      hangoutLink?: string
      conferenceData?: {
        entryPoints?: Array<{ uri?: string }>
      }
      summary: string
      start: { dateTime: string }
      end: { dateTime: string }
    }

    console.log(`✏️  Event updated: ${eventId}`)

    return {
      eventId: event.id,
      eventLink: event.htmlLink,
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      summary: event.summary,
      startDateTime: event.start.dateTime,
      endDateTime: event.end.dateTime,
    }
  }

  /**
   * 刪除 Calendar Event（會議）
   *
   * @param userId - Zentropy User ID
   * @param eventId - Google Calendar Event ID
   */
  async deleteEvent(
    userId: string,
    eventId: string
  ): Promise<void> {
    const accessToken = await this.getAccessToken(userId)

    // 調用 Google Calendar API - Delete Event
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to delete event: ${error}`)
    }

    // 從資料庫中軟刪除（設置 deleted_at）
    await this.prisma.calendarEvent.updateMany({
      where: {
        calendar_event_id: eventId,
        user_id: userId,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    })

    console.log(`🗑️  Event deleted: ${eventId}`)
  }

  /**
   * 創建 Calendar 提醒事件
   *
   * 在 Google Calendar 建立一個 15 分鐘的短事件作為提醒，
   * 設為 transparent（不佔用時間），使用特殊格式與正常會議區分。
   */
  async createCalendarReminder(
    userId: string,
    input: {
      taskTitle: string
      remindAt: string  // ISO 8601
      message?: string
    }
  ): Promise<{ calendarEventId: string; eventLink: string }> {
    const accessToken = await this.getAccessToken(userId)
    const timezone = await this.getUserTimezone(userId)

    const startTime = new Date(input.remindAt)
    const endTime = new Date(startTime.getTime() + 15 * 60 * 1000) // 15 分鐘

    const eventData = {
      summary: `🔔 提醒：${input.taskTitle}`,
      description: input.message || `Zentropy 任務提醒：${input.taskTitle}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: timezone,
      },
      transparency: 'transparent',  // 不佔用時間，顯示為空閒
      colorId: '8',  // 淺灰色，與正常會議區分
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 0 },  // 到時間立即提醒
        ],
      },
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create calendar reminder: ${error}`)
    }

    const event = await response.json() as { id: string; htmlLink: string }

    console.log(`🔔 Calendar reminder created: ${event.id}`)

    return {
      calendarEventId: event.id,
      eventLink: event.htmlLink,
    }
  }

  /**
   * 刪除 Calendar 提醒事件
   */
  async deleteCalendarReminder(
    userId: string,
    calendarEventId: string
  ): Promise<void> {
    const accessToken = await this.getAccessToken(userId)

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${calendarEventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    // 410 Gone = already deleted, treat as success
    if (!response.ok && response.status !== 410) {
      const error = await response.text()
      throw new Error(`Failed to delete calendar reminder: ${error}`)
    }

    console.log(`🔔 Calendar reminder deleted: ${calendarEventId}`)
  }

  /**
   * 計算可用時段
   */
  private calculateAvailableSlots(
    timeMin: string,
    timeMax: string,
    busySlots: BusySlot[],
    workingHours: { start: number; end: number }
  ): AvailableSlot[] {
    const availableSlots: AvailableSlot[] = []
    const startDate = new Date(timeMin)
    const endDate = new Date(timeMax)

    // 逐日處理
    let currentDate = new Date(startDate)
    while (currentDate < endDate) {
      // 只處理工作日（週一到週五）
      const dayOfWeek = currentDate.getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // 設定當天的工作時間
        const dayStart = new Date(currentDate)
        dayStart.setHours(workingHours.start, 0, 0, 0)

        const dayEnd = new Date(currentDate)
        dayEnd.setHours(workingHours.end, 0, 0, 0)

        // 找出當天的 busy slots
        const dayBusySlots = busySlots.filter(slot => {
          const slotStart = new Date(slot.start)
          return slotStart >= dayStart && slotStart < dayEnd
        })

        // 計算可用時段（在工作時間內且不與 busy slots 重疊）
        let currentTime = dayStart
        for (const busySlot of dayBusySlots.sort((a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
        )) {
          const busyStart = new Date(busySlot.start)
          const busyEnd = new Date(busySlot.end)

          // 如果當前時間到 busy start 之間有空檔
          if (currentTime < busyStart) {
            const durationMinutes = (busyStart.getTime() - currentTime.getTime()) / 60000
            if (durationMinutes >= 30) {  // 至少 30 分鐘
              availableSlots.push({
                start: currentTime.toISOString(),
                end: busyStart.toISOString(),
                durationMinutes: Math.floor(durationMinutes),
              })
            }
          }

          currentTime = busyEnd > currentTime ? busyEnd : currentTime
        }

        // 最後一段時間到下班
        if (currentTime < dayEnd) {
          const durationMinutes = (dayEnd.getTime() - currentTime.getTime()) / 60000
          if (durationMinutes >= 30) {
            availableSlots.push({
              start: currentTime.toISOString(),
              end: dayEnd.toISOString(),
              durationMinutes: Math.floor(durationMinutes),
            })
          }
        }
      }

      // 移到下一天
      currentDate.setDate(currentDate.getDate() + 1)
      currentDate.setHours(0, 0, 0, 0)
    }

    return availableSlots
  }

  /**
   * 儲存 Event 到 Zentropy 資料庫
   */
  private async saveEventToDatabase(
    userId: string,
    taskId: string | undefined,
    event: any,
    attendees: string[] | undefined
  ): Promise<void> {
    await this.prisma.calendarEvent.create({
      data: {
        user_id: userId,
        task_id: taskId || null,
        calendar_event_id: event.id,
        summary: event.summary,
        description: event.description || null,
        start_date_time: new Date(event.start.dateTime),
        end_date_time: new Date(event.end.dateTime),
        meet_link: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null,
        event_link: event.htmlLink,
        attendees: attendees || [],
      },
    })

    console.log(`📅 Event saved to database: ${event.id}${taskId ? ` (Task: ${taskId})` : ''}`)
  }
}
