/**
 * GetLatestBriefingUseCase - 取得最新教練簡報
 *
 * Application Layer Use Case
 */

import type {
  ICoachBriefingRepository,
  CoachBriefingData,
} from '@/domain/interfaces/coach-briefing-repository'
import type { BriefingType } from '@/domain/entities/coach-briefing.entity'
import { PrismaCoachBriefingRepository } from '@/infrastructure/repositories/prisma-coach-briefing-repository'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs
// ============================================================================

export interface GetLatestBriefingRequest {
  userId: string
  type?: BriefingType
}

export interface GetLatestBriefingResponse {
  briefing: CoachBriefingData | null
}

// ============================================================================
// Use Case
// ============================================================================

export class GetLatestBriefingUseCase {
  constructor(
    private readonly repository: ICoachBriefingRepository = new PrismaCoachBriefingRepository(),
  ) {}

  async execute(request: GetLatestBriefingRequest): Promise<GetLatestBriefingResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢最新簡報
    const briefing = await this.repository.findLatest(request.userId, request.type)

    return { briefing }
  }

  private validateRequest(request: GetLatestBriefingRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (request.type && !['MORNING', 'EVENING'].includes(request.type)) {
      throw new ValidationException(
        'type must be MORNING or EVENING',
        'type',
      )
    }
  }
}
