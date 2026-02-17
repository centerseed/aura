/**
 * GetLatestBriefingUseCase - 取得最新教練簡報
 *
 * Application Layer Use Case
 *
 * 策略：今天有 → 直接用；今天沒有 → 自動生成
 */

import type {
  ICoachBriefingRepository,
  CoachBriefingData,
} from '@/domain/interfaces/coach-briefing-repository'
import type { BriefingType } from '@/domain/entities/coach-briefing.entity'
import { PrismaCoachBriefingRepository } from '@/infrastructure/repositories/prisma-coach-briefing-repository'
import { GenerateBriefingUseCase } from '@/application/use-cases/coach/generate-briefing'
import { ValidationException } from '@/lib/api-response'
import { resolveTimezone, toDateOnly } from '@/lib/timezone-utils'

// ============================================================================
// DTOs
// ============================================================================

export interface GetLatestBriefingRequest {
  userId: string
  type?: BriefingType
}

export interface GetLatestBriefingResponse {
  briefing: CoachBriefingData | null
  generated?: boolean // 是否是剛自動生成的
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

    // 2. 決定要找的 type（預設 MORNING）
    const type = request.type || 'MORNING'

    // 3. 用 findByDate 查今天的 briefing
    const timezone = await resolveTimezone(request.userId)
    const todayStr = toDateOnly(new Date(), timezone)
    const todayBriefing = await this.repository.findByDate(
      request.userId,
      type,
      new Date(todayStr),
    )

    if (todayBriefing) {
      return { briefing: todayBriefing }
    }

    // 4. 今天沒有 → 自動生成
    try {
      const generateUseCase = new GenerateBriefingUseCase()
      const result = await generateUseCase.execute({
        userId: request.userId,
        type,
        timezone,
      })
      return { briefing: result.briefing, generated: true }
    } catch (error) {
      console.error('[GetLatestBriefing] Auto-generate failed:', error)
      // 生成失敗時，fallback 到最新的（避免白屏）
      const fallback = await this.repository.findLatest(request.userId, request.type)
      return { briefing: fallback }
    }
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
