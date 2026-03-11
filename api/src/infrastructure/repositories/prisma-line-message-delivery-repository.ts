import type {
  FindLineMessageDeliveryArgs,
  ILineMessageDeliveryRepository,
  LineMessageDeliveryData,
  UpsertLineMessageDeliveryData,
} from '@/domain/interfaces/line-message-delivery-repository'
import { prisma } from '@/lib/db'
import type {
  LineDeliveryStatus as PrismaLineDeliveryStatus,
  LineDeliveryType as PrismaLineDeliveryType,
  LineMessageChannel as PrismaLineMessageChannel,
} from '@prisma/client'

export class PrismaLineMessageDeliveryRepository implements ILineMessageDeliveryRepository {
  async findByKey(args: FindLineMessageDeliveryArgs): Promise<LineMessageDeliveryData | null> {
    const row = await prisma.lineMessageDelivery.findUnique({
      where: {
        user_id_channel_delivery_type_delivery_date: {
          user_id: args.userId,
          channel: args.channel as PrismaLineMessageChannel,
          delivery_type: args.deliveryType as PrismaLineDeliveryType,
          delivery_date: args.deliveryDate,
        },
      },
    })

    return row ? this.toDomain(row) : null
  }

  async upsert(data: UpsertLineMessageDeliveryData): Promise<LineMessageDeliveryData> {
    const row = await prisma.lineMessageDelivery.upsert({
      where: {
        user_id_channel_delivery_type_delivery_date: {
          user_id: data.userId,
          channel: data.channel as PrismaLineMessageChannel,
          delivery_type: data.deliveryType as PrismaLineDeliveryType,
          delivery_date: data.deliveryDate,
        },
      },
      create: {
        user_id: data.userId,
        channel: data.channel as PrismaLineMessageChannel,
        delivery_type: data.deliveryType as PrismaLineDeliveryType,
        delivery_date: data.deliveryDate,
        briefing_id: data.briefingId ?? null,
        daily_plan_id: data.dailyPlanId ?? null,
        line_user_id: data.lineUserId,
        status: this.toPrismaStatus(data.status),
        error_message: data.errorMessage ?? null,
        sent_at: data.sentAt ?? null,
      },
      update: {
        briefing_id: data.briefingId ?? null,
        daily_plan_id: data.dailyPlanId ?? null,
        line_user_id: data.lineUserId,
        status: this.toPrismaStatus(data.status),
        error_message: data.errorMessage ?? null,
        sent_at: data.sentAt ?? null,
      },
    })

    return this.toDomain(row)
  }

  private toPrismaStatus(status: UpsertLineMessageDeliveryData['status']): PrismaLineDeliveryStatus {
    return status === 'sent' ? 'SENT' : 'FAILED'
  }

  private toDomain(row: any): LineMessageDeliveryData {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      deliveryType: row.delivery_type,
      deliveryDate: row.delivery_date,
      briefingId: row.briefing_id ?? null,
      dailyPlanId: row.daily_plan_id ?? null,
      lineUserId: row.line_user_id,
      status: row.status === 'SENT' ? 'sent' : 'failed',
      errorMessage: row.error_message ?? null,
      sentAt: row.sent_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
