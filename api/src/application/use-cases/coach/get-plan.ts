/**
 * GetPlanUseCase - 取得每日計畫
 */

import type {
  IDailyPlanRepository,
  DailyPlanData,
} from '@/domain/interfaces/daily-plan-repository'
import { PrismaDailyPlanRepository } from '@/infrastructure/repositories/prisma-daily-plan-repository'
import { ValidationException } from '@/lib/api-response'
import { resolveTimezone, toDateOnly } from '@/lib/timezone-utils'

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

    const timezone = await resolveTimezone(request.userId, request.timezone)
    const date = request.date ? new Date(request.date) : new Date()
    const dateOnly = toDateOnly(date, timezone)

    const plan = await this.repository.findByDate(request.userId, dateOnly)

    return { plan }
  }
}
