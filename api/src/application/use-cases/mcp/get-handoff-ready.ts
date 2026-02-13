/**
 * GetHandoffReadyUseCase - 結構化意圖交接包
 *
 * MCP Resource: zentropy://handoff/ready ★ 核心 Resource
 * 從 DailyPlan 組裝完整的 context_package。
 */

import { prisma } from '@/lib/db'
import { CoachCalibration } from '@/application/services/coach-calibration'
import { ValidationException } from '@/lib/api-response'
import { resolveTimezone, toDateOnly } from '@/lib/timezone-utils'

export interface GetHandoffReadyRequest {
  userId: string
}

export interface HandoffContextPackage {
  why: string
  decisions: Array<{ id: string; summary: string; date: string }>
  related_knowledge: string[]
  coach_notes: string
  acceptance_criteria: string[]
}

export interface HandoffItem {
  id: string
  intent: string
  priority: string
  due: string | null
  status: string
  context_package: HandoffContextPackage
  execution_hints?: {
    suggested_tool?: string
    suggested_first_step?: string
  }
}

export interface GetHandoffReadyResponse {
  generated_at: string
  handoff_items: HandoffItem[]
}

export class GetHandoffReadyUseCase {
  constructor(
    private readonly calibration: CoachCalibration = new CoachCalibration(),
  ) {}

  async execute(request: GetHandoffReadyRequest): Promise<GetHandoffReadyResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    const now = new Date()
    const timezone = await resolveTimezone(request.userId)
    const todayStr = toDateOnly(now, timezone)

    // 1. Get today's DailyPlan
    const plan = await prisma.dailyPlan.findFirst({
      where: {
        user_id: request.userId,
        plan_date: new Date(todayStr),
      },
      orderBy: { created_at: 'desc' },
    })

    if (!plan) {
      return { generated_at: now.toISOString(), handoff_items: [] }
    }

    // 2. Get plan items with task details (exclude completed/deferred)
    const planItems = await prisma.dailyPlanItem.findMany({
      where: {
        plan_id: plan.id,
        completed: false,
        deferred: false,
      },
      include: {
        task: {
          include: {
            product: {
              include: { area: true },
            },
            sub_tasks: {
              where: { deleted_at: null },
              select: {
                id: true,
                content: true,
                estimated_minutes: true,
              },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    })

    // 3. Get calibration data for coach_notes
    const calibResult = await this.calibration.calculate(request.userId)

    // 4. Assemble handoff items
    const handoffItems: HandoffItem[] = planItems
      .filter(item => item.task) // skip items without linked task
      .map(item => {
        const task = item.task!
        const areaName = task.product?.area?.name ?? 'Unknown'
        const dueDate = task.due_date
          ? new Date(task.due_date).toISOString().substring(0, 10)
          : null

        // Generate coach_notes from calibration
        const coachNotes = this.generateCoachNotes(
          areaName,
          item.estimated_minutes,
          calibResult,
        )

        // Priority from urgency_level or infer from position
        const priority = this.inferPriority(item.order, dueDate, now)

        return {
          id: task.id,
          intent: task.content,
          priority,
          due: dueDate,
          status: 'active',
          context_package: {
            why: item.reasoning || '',
            decisions: [],
            related_knowledge: [],
            coach_notes: coachNotes,
            acceptance_criteria: [],
          },
          execution_hints: {
            suggested_first_step: task.sub_tasks?.length
              ? `Has ${task.sub_tasks.length} sub-tasks already defined`
              : undefined,
          },
        }
      })

    return {
      generated_at: now.toISOString(),
      handoff_items: handoffItems,
    }
  }

  private generateCoachNotes(
    areaName: string,
    estimatedMinutes: number | null,
    calibResult: { overallRatio: number; byArea: Array<{ areaName: string; ratio: number; sampleCount: number }>; totalSamples: number },
  ): string {
    if (calibResult.totalSamples < 3) {
      return 'No calibration data yet.'
    }

    const areaBias = calibResult.byArea.find(a => a.areaName === areaName)
    if (!areaBias || areaBias.sampleCount < 3) {
      return `Overall bias: ${calibResult.overallRatio.toFixed(2)}x (${calibResult.totalSamples} samples).`
    }

    const parts: string[] = [
      `${areaName} tasks: actual/estimated = ${areaBias.ratio.toFixed(2)}x (${areaBias.sampleCount} samples).`,
    ]

    if (estimatedMinutes && areaBias.ratio > 1.2) {
      const adjustedMinutes = Math.round(estimatedMinutes * areaBias.ratio)
      parts.push(`Estimated ${estimatedMinutes}min, suggest ${adjustedMinutes}min.`)
    }

    return parts.join(' ')
  }

  private inferPriority(order: number, dueDate: string | null, now: Date): string {
    if (dueDate) {
      const due = new Date(dueDate)
      const daysUntil = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil <= 0) return 'high'
      if (daysUntil <= 1) return 'high'
      if (daysUntil <= 3) return 'medium'
    }
    if (order <= 2) return 'high'
    return 'medium'
  }
}
