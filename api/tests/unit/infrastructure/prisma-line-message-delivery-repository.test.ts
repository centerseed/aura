import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindUnique = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    lineMessageDelivery: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}))

const { PrismaLineMessageDeliveryRepository } = await import('@/infrastructure/repositories/prisma-line-message-delivery-repository')

describe('PrismaLineMessageDeliveryRepository', () => {
  const repository = new PrismaLineMessageDeliveryRepository()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('findByKey returns normalized sent delivery', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'delivery-1',
      user_id: 'user-1',
      channel: 'LINE',
      delivery_type: 'MORNING_BRIEFING',
      delivery_date: new Date('2026-03-11T00:00:00.000Z'),
      briefing_id: 'briefing-1',
      daily_plan_id: 'plan-1',
      line_user_id: 'line-1',
      status: 'SENT',
      error_message: null,
      sent_at: new Date('2026-03-11T07:00:00.000Z'),
      created_at: new Date(),
      updated_at: new Date(),
    })

    const result = await repository.findByKey({
      userId: 'user-1',
      channel: 'LINE',
      deliveryType: 'MORNING_BRIEFING',
      deliveryDate: new Date('2026-03-11T00:00:00.000Z'),
    })

    expect(result?.status).toBe('sent')
    expect(mockFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user_id_channel_delivery_type_delivery_date: expect.objectContaining({
          user_id: 'user-1',
          channel: 'LINE',
          delivery_type: 'MORNING_BRIEFING',
        }),
      }),
    }))
  })

  it('upsert persists failed deliveries with normalized status', async () => {
    mockUpsert.mockResolvedValue({
      id: 'delivery-1',
      user_id: 'user-1',
      channel: 'LINE',
      delivery_type: 'MORNING_BRIEFING',
      delivery_date: new Date('2026-03-11T00:00:00.000Z'),
      briefing_id: null,
      daily_plan_id: null,
      line_user_id: 'line-1',
      status: 'FAILED',
      error_message: 'LINE 500',
      sent_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const result = await repository.upsert({
      userId: 'user-1',
      channel: 'LINE',
      deliveryType: 'MORNING_BRIEFING',
      deliveryDate: new Date('2026-03-11T00:00:00.000Z'),
      lineUserId: 'line-1',
      status: 'failed',
      errorMessage: 'LINE 500',
      sentAt: null,
    })

    expect(result.status).toBe('failed')
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: 'FAILED',
        error_message: 'LINE 500',
      }),
      update: expect.objectContaining({
        status: 'FAILED',
        error_message: 'LINE 500',
      }),
    }))
  })
})
