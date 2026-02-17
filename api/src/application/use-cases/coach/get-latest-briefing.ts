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
import { prisma } from '@/lib/db'

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
      const refreshed = await this.refreshTaskStatuses(todayBriefing)
      return { briefing: refreshed }
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

  private async refreshTaskStatuses(briefing: CoachBriefingData): Promise<CoachBriefingData> {
    const taskIds = [
      ...briefing.overdueTasks.map(t => t.id),
      ...briefing.approachingTasks.map(t => t.id),
      ...briefing.remainingTasks.map(t => t.id),
    ]
    if (taskIds.length === 0) return briefing

    const currentStatuses = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, status: true },
    })

    const statusMap = new Map(currentStatuses.map(t => [t.id, t.status]))
    const completedIds = new Set<string>()

    const isCompleted = (taskId: string) => {
      const status = statusMap.get(taskId)
      return !status || status === 'ARCHIVE'
    }

    const filteredOverdue = briefing.overdueTasks.filter(task => {
      if (isCompleted(task.id)) {
        completedIds.add(task.id)
        return false
      }
      return true
    })

    const filteredApproaching = briefing.approachingTasks.filter(task => {
      if (isCompleted(task.id)) {
        completedIds.add(task.id)
        return false
      }
      return true
    })

    const filteredRemaining = briefing.remainingTasks.filter(task => {
      if (isCompleted(task.id)) {
        completedIds.add(task.id)
        return false
      }
      return true
    })

    // 合併新完成的任務（去重）
    const existingCompletedIds = new Set(briefing.completedTasks.map(t => t.id))
    const newlyCompleted = [
      ...briefing.overdueTasks,
      ...briefing.approachingTasks,
      ...briefing.remainingTasks,
    ]
      .filter(t => completedIds.has(t.id) && !existingCompletedIds.has(t.id))
      .map(t => ({ ...t, status: 'completed' }))

    return {
      ...briefing,
      overdueTasks: filteredOverdue,
      approachingTasks: filteredApproaching,
      remainingTasks: filteredRemaining,
      completedTasks: [...briefing.completedTasks, ...newlyCompleted],
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
