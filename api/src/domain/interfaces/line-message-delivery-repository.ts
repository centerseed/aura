export type LineMessageChannel = 'LINE'

export type LineDeliveryType = 'MORNING_BRIEFING'

export type LineDeliveryStatus = 'sent' | 'failed'

export interface LineMessageDeliveryData {
  id: string
  userId: string
  channel: LineMessageChannel
  deliveryType: LineDeliveryType
  deliveryDate: Date
  briefingId: string | null
  dailyPlanId: string | null
  lineUserId: string
  status: LineDeliveryStatus
  errorMessage: string | null
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FindLineMessageDeliveryArgs {
  userId: string
  channel: LineMessageChannel
  deliveryType: LineDeliveryType
  deliveryDate: Date
}

export interface UpsertLineMessageDeliveryData extends FindLineMessageDeliveryArgs {
  briefingId?: string | null
  dailyPlanId?: string | null
  lineUserId: string
  status: LineDeliveryStatus
  errorMessage?: string | null
  sentAt?: Date | null
}

export interface ILineMessageDeliveryRepository {
  findByKey(args: FindLineMessageDeliveryArgs): Promise<LineMessageDeliveryData | null>
  upsert(data: UpsertLineMessageDeliveryData): Promise<LineMessageDeliveryData>
}
