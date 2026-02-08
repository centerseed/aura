/**
 * CalendarService Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CalendarService } from '@/lib/calendar-service'

// Mock OAuthService - use hoisted fn to survive clearAllMocks
const mockGetAccessToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/oauth-service', () => {
  return {
    OAuthService: class {
      getAccessToken = mockGetAccessToken
    },
  }
})

// Mock Prisma Client
const mockPrisma = {
  user: {
    findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
  },
  calendarEvent: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}

describe('CalendarService', () => {
  let service: CalendarService
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAccessToken.mockResolvedValue('mock-access-token')
    fetchSpy = vi.fn()
    global.fetch = fetchSpy
    service = new CalendarService(mockPrisma as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================================================
  // queryFreeBusy
  // ========================================================================
  describe('queryFreeBusy', () => {
    it('should call Google Calendar FreeBusy API with correct params', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          calendars: {
            primary: {
              busy: [
                { start: '2026-02-09T10:00:00Z', end: '2026-02-09T11:00:00Z' },
              ],
            },
          },
        }),
      })

      const result = await service.queryFreeBusy(
        'user-1',
        '2026-02-09T00:00:00Z',
        '2026-02-09T23:59:59Z'
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        })
      )

      expect(result.busySlots).toHaveLength(1)
      expect(result.timeMin).toBe('2026-02-09T00:00:00Z')
      expect(result.timeMax).toBe('2026-02-09T23:59:59Z')
    })

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        text: async () => 'Unauthorized',
      })

      await expect(
        service.queryFreeBusy('user-1', '2026-02-09T00:00:00Z', '2026-02-09T23:59:59Z')
      ).rejects.toThrow('Failed to query free/busy')
    })

    it('should calculate available slots excluding busy periods', async () => {
      // Use local timezone dates
      // Monday 2026-02-09, busy 10:00-11:00 local time
      const busyStart = new Date(2026, 1, 9, 10, 0, 0)
      const busyEnd = new Date(2026, 1, 9, 11, 0, 0)

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          calendars: {
            primary: {
              busy: [
                { start: busyStart.toISOString(), end: busyEnd.toISOString() },
              ],
            },
          },
        }),
      })

      const monday = new Date(2026, 1, 9, 0, 0, 0)
      const tuesday = new Date(2026, 1, 10, 0, 0, 0)

      const result = await service.queryFreeBusy(
        'user-1',
        monday.toISOString(),
        tuesday.toISOString(),
        { start: 9, end: 18 }
      )

      // Should have slot 9-10 (60min) and 11-18 (420min)
      expect(result.availableSlots).toHaveLength(2)
      expect(result.availableSlots[0].durationMinutes).toBe(60)
      expect(result.availableSlots[1].durationMinutes).toBe(420)
    })

    it('should skip weekends', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          calendars: { primary: { busy: [] } },
        }),
      })

      // 2026-02-07 is Saturday, 2026-02-08 is Sunday (in Asia/Taipei)
      const saturday = new Date(2026, 1, 7, 0, 0, 0)
      const monday = new Date(2026, 1, 9, 0, 0, 0)

      const result = await service.queryFreeBusy(
        'user-1',
        saturday.toISOString(),
        monday.toISOString(),
        { start: 9, end: 18 }
      )

      expect(result.availableSlots).toHaveLength(0)
    })

    it('should handle empty busy slots', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          calendars: { primary: { busy: [] } },
        }),
      })

      const monday = new Date(2026, 1, 9, 0, 0, 0)
      const tuesday = new Date(2026, 1, 10, 0, 0, 0)

      const result = await service.queryFreeBusy(
        'user-1',
        monday.toISOString(),
        tuesday.toISOString(),
        { start: 9, end: 18 }
      )

      // Full working day 9-18 = 540 minutes
      expect(result.availableSlots).toHaveLength(1)
      expect(result.availableSlots[0].durationMinutes).toBe(540)
    })
  })

  // ========================================================================
  // createEvent
  // ========================================================================
  describe('createEvent', () => {
    const mockEventResponse = {
      id: 'event-123',
      htmlLink: 'https://calendar.google.com/event/123',
      hangoutLink: 'https://meet.google.com/abc-def',
      summary: 'Test Meeting',
      start: { dateTime: '2026-02-09T10:00:00+08:00' },
      end: { dateTime: '2026-02-09T11:00:00+08:00' },
    }

    beforeEach(() => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockEventResponse,
      })
      mockPrisma.calendarEvent.create.mockResolvedValue({})
    })

    it('should call Google Calendar API to create event', async () => {
      const result = await service.createEvent('user-1', {
        summary: 'Test Meeting',
        startDateTime: '2026-02-09T10:00:00+08:00',
        endDateTime: '2026-02-09T11:00:00+08:00',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('calendars/primary/events'),
        expect.objectContaining({ method: 'POST' })
      )
      expect(result.eventId).toBe('event-123')
      expect(result.meetLink).toBe('https://meet.google.com/abc-def')
    })

    it('should include conferenceDataVersion when generateMeetLink is true', async () => {
      await service.createEvent('user-1', {
        summary: 'Meet',
        startDateTime: '2026-02-09T10:00:00+08:00',
        endDateTime: '2026-02-09T11:00:00+08:00',
        generateMeetLink: true,
      })

      const calledUrl = fetchSpy.mock.calls[0][0]
      expect(calledUrl).toContain('conferenceDataVersion=1')
    })

    it('should save event to database', async () => {
      await service.createEvent('user-1', {
        summary: 'Test',
        startDateTime: '2026-02-09T10:00:00+08:00',
        endDateTime: '2026-02-09T11:00:00+08:00',
        taskId: 'task-abc',
      })

      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-1',
          task_id: 'task-abc',
          calendar_event_id: 'event-123',
        }),
      })
    })

    it('should include attendees in event data', async () => {
      await service.createEvent('user-1', {
        summary: 'Test',
        startDateTime: '2026-02-09T10:00:00+08:00',
        endDateTime: '2026-02-09T11:00:00+08:00',
        attendees: ['a@test.com', 'b@test.com'],
      })

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.attendees).toEqual([
        { email: 'a@test.com' },
        { email: 'b@test.com' },
      ])
    })

    it('should append task ID to description', async () => {
      await service.createEvent('user-1', {
        summary: 'Test',
        description: 'Existing desc',
        startDateTime: '2026-02-09T10:00:00+08:00',
        endDateTime: '2026-02-09T11:00:00+08:00',
        taskId: 'task-xyz',
      })

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.description).toContain('[Zentropy Task: task-xyz]')
      expect(body.description).toContain('Existing desc')
    })

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        text: async () => 'Bad Request',
      })

      await expect(
        service.createEvent('user-1', {
          summary: 'Test',
          startDateTime: '2026-02-09T10:00:00+08:00',
          endDateTime: '2026-02-09T11:00:00+08:00',
        })
      ).rejects.toThrow('Failed to create event')
    })
  })

  // ========================================================================
  // updateEvent
  // ========================================================================
  describe('updateEvent', () => {
    it('should fetch existing event then update', async () => {
      const existingEvent = {
        id: 'event-123',
        summary: 'Old Title',
        start: { dateTime: '2026-02-09T10:00:00+08:00' },
        end: { dateTime: '2026-02-09T11:00:00+08:00' },
      }

      const updatedEvent = {
        id: 'event-123',
        htmlLink: 'https://calendar.google.com/event/123',
        summary: 'New Title',
        start: { dateTime: '2026-02-09T10:00:00+08:00' },
        end: { dateTime: '2026-02-09T11:00:00+08:00' },
      }

      // First call = GET, second call = PUT
      fetchSpy
        .mockResolvedValueOnce({ ok: true, json: async () => existingEvent })
        .mockResolvedValueOnce({ ok: true, json: async () => updatedEvent })

      const result = await service.updateEvent('user-1', 'event-123', {
        summary: 'New Title',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[0][1].method).toBe('GET')
      expect(fetchSpy.mock.calls[1][1].method).toBe('PUT')
      expect(result.summary).toBe('New Title')
    })

    it('should only update provided fields', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'event-123',
            summary: 'Original',
            description: 'Keep this',
            start: { dateTime: '2026-02-09T10:00:00+08:00' },
            end: { dateTime: '2026-02-09T11:00:00+08:00' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'event-123',
            htmlLink: 'https://calendar.google.com/event/123',
            summary: 'Updated',
            description: 'Keep this',
            start: { dateTime: '2026-02-09T10:00:00+08:00' },
            end: { dateTime: '2026-02-09T11:00:00+08:00' },
          }),
        })

      await service.updateEvent('user-1', 'event-123', { summary: 'Updated' })

      const putBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(putBody.description).toBe('Keep this')
      expect(putBody.summary).toBe('Updated')
    })

    it('should throw when GET fails', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        text: async () => 'Not Found',
      })

      await expect(
        service.updateEvent('user-1', 'event-123', { summary: 'X' })
      ).rejects.toThrow('Failed to get event')
    })

    it('should throw when PUT fails', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'event-123', summary: 'Old' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Conflict',
        })

      await expect(
        service.updateEvent('user-1', 'event-123', { summary: 'New' })
      ).rejects.toThrow('Failed to update event')
    })
  })

  // ========================================================================
  // deleteEvent
  // ========================================================================
  describe('deleteEvent', () => {
    it('should call DELETE API and soft-delete in DB', async () => {
      fetchSpy.mockResolvedValue({ ok: true })
      mockPrisma.calendarEvent.updateMany.mockResolvedValue({ count: 1 })

      await service.deleteEvent('user-1', 'event-123')

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('events/event-123'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(mockPrisma.calendarEvent.updateMany).toHaveBeenCalledWith({
        where: {
          calendar_event_id: 'event-123',
          user_id: 'user-1',
          deleted_at: null,
        },
        data: {
          deleted_at: expect.any(Date),
        },
      })
    })

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        text: async () => 'Server Error',
      })

      await expect(
        service.deleteEvent('user-1', 'event-123')
      ).rejects.toThrow('Failed to delete event')
    })
  })

  // ========================================================================
  // createCalendarReminder
  // ========================================================================
  describe('createCalendarReminder', () => {
    it('should create a 15-minute transparent event', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'reminder-event-1',
          htmlLink: 'https://calendar.google.com/event/r1',
        }),
      })

      const result = await service.createCalendarReminder('user-1', {
        taskTitle: 'Review PR',
        remindAt: '2026-02-09T09:00:00Z',
      })

      expect(result.calendarEventId).toBe('reminder-event-1')

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.transparency).toBe('transparent')
      expect(body.reminders.overrides[0].minutes).toBe(0)

      // Verify 15-minute duration
      const start = new Date(body.start.dateTime)
      const end = new Date(body.end.dateTime)
      expect(end.getTime() - start.getTime()).toBe(15 * 60 * 1000)
    })

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        text: async () => 'Error',
      })

      await expect(
        service.createCalendarReminder('user-1', {
          taskTitle: 'Test',
          remindAt: '2026-02-09T09:00:00Z',
        })
      ).rejects.toThrow('Failed to create calendar reminder')
    })
  })

  // ========================================================================
  // deleteCalendarReminder
  // ========================================================================
  describe('deleteCalendarReminder', () => {
    it('should delete reminder event', async () => {
      fetchSpy.mockResolvedValue({ ok: true })

      await service.deleteCalendarReminder('user-1', 'reminder-event-1')

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('events/reminder-event-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should treat 410 Gone as success', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 410 })

      // Should not throw
      await service.deleteCalendarReminder('user-1', 'reminder-event-1')
    })

    it('should throw on other errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      })

      await expect(
        service.deleteCalendarReminder('user-1', 'reminder-event-1')
      ).rejects.toThrow('Failed to delete calendar reminder')
    })
  })

  // ========================================================================
  // getAccessToken (private, tested indirectly)
  // ========================================================================
  describe('authentication', () => {
    it('should throw when OAuth not connected', async () => {
      mockGetAccessToken.mockResolvedValue(null)

      await expect(
        service.queryFreeBusy('user-1', '2026-02-09T00:00:00Z', '2026-02-09T23:59:59Z')
      ).rejects.toThrow('Google Calendar not connected')
    })
  })
})
