import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockUserFindMany = vi.fn()
const mockPushMessage = vi.fn()
const mockFindDelivery = vi.fn()
const mockUpsertDelivery = vi.fn()
const mockFindBriefingByDate = vi.fn()
const mockFindPlanByDate = vi.fn()
const mockGenerateBriefing = vi.fn()
const mockGetLocalHour = vi.fn()
const mockToDateOnly = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
    },
  },
}))

vi.mock('@/lib/line-client', () => ({
  getLineClient: vi.fn(() => ({
    pushMessage: mockPushMessage,
  })),
  formatMorningBriefingPush: vi.fn((_briefing, _plan) => 'formatted message'),
}))

vi.mock('@/infrastructure/repositories/prisma-line-message-delivery-repository', () => ({
  PrismaLineMessageDeliveryRepository: vi.fn().mockImplementation(() => ({
    findByKey: mockFindDelivery,
    upsert: mockUpsertDelivery,
  })),
}))

vi.mock('@/infrastructure/repositories/prisma-coach-briefing-repository', () => ({
  PrismaCoachBriefingRepository: vi.fn().mockImplementation(() => ({
    findByDate: mockFindBriefingByDate,
  })),
}))

vi.mock('@/infrastructure/repositories/prisma-daily-plan-repository', () => ({
  PrismaDailyPlanRepository: vi.fn().mockImplementation(() => ({
    findByDate: mockFindPlanByDate,
  })),
}))

vi.mock('@/application/use-cases/coach/generate-briefing', () => ({
  GenerateBriefingUseCase: vi.fn().mockImplementation(() => ({
    execute: mockGenerateBriefing,
  })),
}))

vi.mock('@/lib/timezone-utils', () => ({
  getLocalHour: mockGetLocalHour,
  toDateOnly: mockToDateOnly,
}))

const { POST } = await import('@/app/api/line/cron/morning-briefing/route')

function buildRequest() {
  return new NextRequest('http://localhost/api/line/cron/morning-briefing', {
    method: 'POST',
    headers: {
      authorization: 'Bearer cron-secret',
    },
  })
}

describe('POST /api/line/cron/morning-briefing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    mockGetLocalHour.mockReturnValue(7)
    mockToDateOnly.mockReturnValue(new Date('2026-03-11T00:00:00.000Z'))
    mockUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        line_user_id: 'line-1',
        timezone: 'Asia/Taipei',
        settings: {
          briefingSchedule: {
            morning: {
              enabled: true,
              windowStart: 7,
              windowEnd: 14,
            },
          },
        },
      },
    ])
    mockFindDelivery.mockResolvedValue(null)
    mockFindBriefingByDate.mockResolvedValue({
      id: 'briefing-1',
      briefingDate: new Date('2026-03-11T00:00:00.000Z'),
      summary: 'summary',
      recommendations: [{ action: 'do first thing' }],
    })
    mockFindPlanByDate.mockResolvedValue({
      id: 'plan-1',
      items: [{ id: 'item-1', order: 1, content: 'task', estimatedMinutes: 30, status: 'today' }],
    })
    mockGenerateBriefing.mockResolvedValue({
      briefing: {
        id: 'briefing-generated',
        briefingDate: new Date('2026-03-11T00:00:00.000Z'),
        summary: 'generated summary',
        recommendations: [{ action: 'generated first thing' }],
      },
    })
    mockUpsertDelivery.mockResolvedValue({})
  })

  it('skips users whose morning schedule does not match current hour', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        line_user_id: 'line-1',
        timezone: 'Asia/Taipei',
        settings: {
          briefingSchedule: {
            morning: {
              enabled: true,
              windowStart: 8,
              windowEnd: 14,
            },
          },
        },
      },
    ])

    const response = await POST(buildRequest())
    const body = await response.json()

    expect(body.eligible).toBe(0)
    expect(body.skipped).toBe(1)
    expect(mockPushMessage).not.toHaveBeenCalled()
  })

  it('skips users who already have a sent delivery', async () => {
    mockFindDelivery.mockResolvedValue({ status: 'sent' })

    const response = await POST(buildRequest())
    const body = await response.json()

    expect(body.eligible).toBe(1)
    expect(body.sent).toBe(0)
    expect(body.skipped).toBe(1)
    expect(mockPushMessage).not.toHaveBeenCalled()
  })

  it('reuses existing briefing and records sent delivery', async () => {
    const response = await POST(buildRequest())
    const body = await response.json()

    expect(body.reusedBriefing).toBe(1)
    expect(body.generatedBriefing).toBe(0)
    expect(body.sent).toBe(1)
    expect(mockPushMessage).toHaveBeenCalledWith({
      to: 'line-1',
      messages: [{ type: 'text', text: 'formatted message' }],
    })
    expect(mockUpsertDelivery).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sent',
      briefingId: 'briefing-1',
      dailyPlanId: 'plan-1',
    }))
  })

  it('generates a new briefing when none exists', async () => {
    mockFindBriefingByDate.mockResolvedValue(null)

    const response = await POST(buildRequest())
    const body = await response.json()

    expect(body.generatedBriefing).toBe(1)
    expect(mockGenerateBriefing).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      type: 'MORNING',
      timezone: 'Asia/Taipei',
    }))
    expect(mockUpsertDelivery).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sent',
      briefingId: 'briefing-generated',
    }))
  })

  it('records failed delivery and continues response when push fails', async () => {
    mockPushMessage.mockRejectedValueOnce(new Error('LINE push failed'))

    const response = await POST(buildRequest())
    const body = await response.json()

    expect(body.failed).toBe(1)
    expect(mockUpsertDelivery).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      errorMessage: 'LINE push failed',
      lineUserId: 'line-1',
    }))
  })
})
