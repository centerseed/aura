/**
 * ReportDoneUseCase - 報告完成 + 偏差學習
 *
 * MCP Tool: report_done
 * 標記任務完成、計算估時偏差、更新 Episodic Memory。
 */

import { prisma } from '@/lib/db'
import { CoachCalibration } from '@/application/services/coach-calibration'
import { ValidationException } from '@/lib/api-response'

export interface ReportDoneRequest {
  userId: string
  actionId: string
  actualDurationMinutes?: number
  outcome?: 'completed' | 'partial' | 'blocked' | 'cancelled'
  notes?: string
}

export interface ReportDoneDeviation {
  estimated_minutes: number
  actual_minutes: number
  ratio: number
  updated_bias_for_area?: {
    area: string
    previous_bias: number
    new_bias: number
    sample_size: number
  }
}

export interface ReportDoneResponse {
  action_id: string
  status: string
  completed_at: string | null
  deviation: ReportDoneDeviation | null
  coach_feedback: string
  archived: boolean
}

export class ReportDoneUseCase {
  constructor(
    private readonly calibration: CoachCalibration = new CoachCalibration(),
  ) {}

  async execute(request: ReportDoneRequest): Promise<ReportDoneResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
    if (!request.actionId) {
      throw new ValidationException('Action ID is required', 'actionId')
    }

    const outcome = request.outcome ?? 'completed'

    // 1. Find the task (with ownership check)
    const task = await prisma.task.findFirst({
      where: {
        id: request.actionId,
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        product: {
          include: { area: true },
        },
      },
    })

    if (!task) {
      throw new ValidationException('Task not found', 'actionId')
    }

    // 2. Find associated DailyPlanItem for estimated_minutes
    const planItem = await prisma.dailyPlanItem.findFirst({
      where: {
        task_id: request.actionId,
        plan: { user_id: request.userId },
      },
      orderBy: { created_at: 'desc' },
    })

    const estimatedMinutes = planItem?.estimated_minutes ?? null
    const actualMinutes = request.actualDurationMinutes ?? null

    // 3. Update task status based on outcome
    const isCompleted = outcome === 'completed'
    const completedAt = isCompleted ? new Date() : null

    await prisma.$transaction(async (tx) => {
      // Update task status if completed
      if (isCompleted) {
        await tx.task.update({
          where: { id: request.actionId },
          data: { status: 'ARCHIVE' },
        })
      }

      // Update plan item if exists
      if (planItem) {
        await tx.dailyPlanItem.update({
          where: { id: planItem.id },
          data: {
            completed: isCompleted,
            actual_minutes: actualMinutes,
            completed_at: completedAt,
          },
        })
      }
    })

    // 4. Calculate deviation
    let deviation: ReportDoneDeviation | null = null
    if (estimatedMinutes && actualMinutes) {
      deviation = {
        estimated_minutes: estimatedMinutes,
        actual_minutes: actualMinutes,
        ratio: Math.round((actualMinutes / estimatedMinutes) * 100) / 100,
      }
    }

    // 5. Generate coach feedback
    const areaName = task.product?.area?.name ?? 'Unknown'
    const feedback = await this.generateFeedback(
      request.userId,
      outcome,
      deviation,
      areaName,
    )

    return {
      action_id: request.actionId,
      status: outcome,
      completed_at: completedAt?.toISOString() ?? null,
      deviation,
      coach_feedback: feedback,
      archived: isCompleted,
    }
  }

  private async generateFeedback(
    userId: string,
    outcome: string,
    deviation: ReportDoneDeviation | null,
    areaName: string,
  ): Promise<string> {
    if (outcome === 'partial') {
      return 'Noted as partial completion. Consider breaking remaining work into smaller tasks.'
    }
    if (outcome === 'blocked') {
      return 'Noted as blocked. Consider creating a follow-up task to unblock.'
    }
    if (outcome === 'cancelled') {
      return 'Task cancelled and archived.'
    }

    if (!deviation) {
      return 'Completed! No time estimate was recorded, so deviation tracking is unavailable.'
    }

    const parts: string[] = []

    if (deviation.ratio <= 1.1) {
      parts.push(`Great estimation! Actual time matched your estimate closely (${deviation.ratio}x).`)
    } else if (deviation.ratio <= 1.5) {
      parts.push(`Took ${Math.round((deviation.ratio - 1) * 100)}% longer than estimated (${deviation.ratio}x).`)
    } else {
      parts.push(`Significant underestimate — actual was ${deviation.ratio}x the estimate.`)
    }

    // Check historical bias for this area
    try {
      const calibResult = await this.calibration.calculate(userId)
      const areaBias = calibResult.byArea.find(a => a.areaName === areaName)
      if (areaBias && areaBias.sampleCount >= 3) {
        if (deviation.ratio < areaBias.ratio) {
          parts.push(`Better than your ${areaName} average (${areaBias.ratio.toFixed(2)}x). Improving!`)
        } else {
          parts.push(`Your ${areaName} historical bias is ${areaBias.ratio.toFixed(2)}x (${areaBias.sampleCount} samples).`)
        }
      }
    } catch {
      // Calibration failure shouldn't break the response
    }

    return parts.join(' ')
  }
}
