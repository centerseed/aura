/**
 * GetPlanUseCase - 取得每日計畫
 */

import type {
  IDailyPlanRepository,
  DailyPlanData,
} from '@/domain/interfaces/daily-plan-repository'
import { PrismaDailyPlanRepository } from '@/infrastructure/repositories/prisma-daily-plan-repository'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

export interface GetPlanRequest {
  userId: string
  date?: string
  timezone?: string
}

export interface GetPlanResponse {
  plan: DailyPlanData | null
}

export class GetPlanUseCase {
  constructor(
    private readonly repository: IDailyPlanRepository = new PrismaDailyPlanRepository(),
  ) {}

  async execute(request: GetPlanRequest): Promise<GetPlanResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    const timezone = await this.resolveTimezone(request)
    const date = request.date ? new Date(request.date) : new Date()
    const dateOnly = this.toDateOnly(date, timezone)

    const plan = await this.repository.findByDate(request.userId, dateOnly)

    return { plan }
  }

  private async resolveTimezone(request: GetPlanRequest): Promise<string> {
    if (request.timezone) return request.timezone

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { timezone: true },
    })

    return user?.timezone || 'Asia/Taipei'
  }

  private toDateOnly(date: Date, timezone: string): Date {
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone })
    return new Date(dateStr + 'T00:00:00.000Z')
  }
}
