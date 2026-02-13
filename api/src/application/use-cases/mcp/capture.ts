/**
 * CaptureUseCase - 統一入口（取代 capture_thought）
 *
 * MCP Tool: capture
 * 支援 3 種 mode: thought（預設）、execution_plan、result
 *
 * Note: thought mode is a lightweight fallback. The MCP handler routes
 * thought mode through apiClient.captureThought() (brain-dump pipeline)
 * for full AI classification + DB persistence.
 */

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

export type CaptureMode = 'thought' | 'execution_plan' | 'result'

export interface CaptureRequest {
  userId: string
  content: string
  source: string
  mode?: CaptureMode
  parent_id?: string
  context_hint?: string
}

export interface CaptureResponse {
  id: string
  status: string
  classified_as: CaptureMode
  filed_to: {
    area: string
    product: string
    topic?: string
  }
  parent_id: string | null
  agent_actions: string[]
  _warning?: string | null
}

export class CaptureUseCase {
  async execute(request: CaptureRequest): Promise<CaptureResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
    if (!request.content) {
      throw new ValidationException('Content is required', 'content')
    }

    const mode = request.mode ?? 'thought'

    switch (mode) {
      case 'thought':
        return this.handleThought(request)
      case 'execution_plan':
        return this.handleExecutionPlan(request)
      case 'result':
        return this.handleResult(request)
      default:
        throw new ValidationException(`Invalid mode: ${mode}`, 'mode')
    }
  }

  /**
   * thought mode — 自由文字，Gatekeeper 自動分類
   *
   * Lightweight fallback; the MCP handler routes thought mode through
   * the brain-dump pipeline for full persistence.
   */
  private async handleThought(request: CaptureRequest): Promise<CaptureResponse> {
    // Parse context_hint for filing
    const filedTo = this.parseContextHint(request.context_hint)

    return {
      id: randomUUID(),
      status: 'processed',
      classified_as: 'thought',
      filed_to: filedTo,
      parent_id: null,
      agent_actions: [
        'Gatekeeper: classified as thought',
        `Librarian: filed to ${filedTo.area}/${filedTo.product}`,
      ],
    }
  }

  /**
   * execution_plan mode — 結構化子任務回流
   */
  private async handleExecutionPlan(request: CaptureRequest): Promise<CaptureResponse> {
    if (!request.parent_id) {
      throw new ValidationException(
        'parent_id is required for execution_plan mode',
        'parent_id',
      )
    }

    // Verify parent task exists and belongs to user
    const parentTask = await prisma.task.findFirst({
      where: {
        id: request.parent_id,
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        product: {
          include: { area: true },
        },
      },
    })

    if (!parentTask) {
      throw new ValidationException('Parent task not found', 'parent_id')
    }

    // Parse content as JSON with sub_items
    let parsedContent: {
      sub_items?: Array<{ title: string; estimated_minutes?: number }>
      total_estimated_minutes?: number
      codebase_context?: string
    }

    try {
      parsedContent = JSON.parse(request.content)
    } catch {
      throw new ValidationException('Content must be valid JSON for execution_plan mode', 'content')
    }

    const subItems = parsedContent.sub_items ?? []
    const agentActions: string[] = [
      'Gatekeeper: identified as execution plan',
    ]

    // Create sub-tasks under parent
    if (subItems.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < subItems.length; i++) {
          await tx.subTask.create({
            data: {
              task_id: request.parent_id!,
              content: subItems[i].title,
              estimated_minutes: subItems[i].estimated_minutes ?? null,
              order: i + 1,
              completed: false,
            },
          })
        }
      })

      agentActions.push(`Librarian: created ${subItems.length} sub-items under ${parentTask.content}`)
    }

    if (parsedContent.total_estimated_minutes) {
      agentActions.push(
        `Coach: total estimated ${parsedContent.total_estimated_minutes}min`,
      )
    }

    const areaName = parentTask.product?.area?.name ?? 'Unknown'
    const productName = parentTask.product?.name ?? 'Unknown'

    return {
      id: randomUUID(),
      status: 'processed',
      classified_as: 'execution_plan',
      filed_to: {
        area: areaName,
        product: productName,
      },
      parent_id: request.parent_id,
      agent_actions: agentActions,
    }
  }

  /**
   * result mode — 執行結果回報（含 DB 持久化）
   */
  private async handleResult(request: CaptureRequest): Promise<CaptureResponse> {
    if (!request.parent_id) {
      throw new ValidationException(
        'parent_id is required for result mode',
        'parent_id',
      )
    }

    const parentTask = await prisma.task.findFirst({
      where: {
        id: request.parent_id,
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        product: {
          include: { area: true },
        },
      },
    })

    if (!parentTask) {
      throw new ValidationException('Parent task not found', 'parent_id')
    }

    // Parse result content
    let parsedContent: {
      outcome?: string
      actual_duration_minutes?: number
      notes?: string
      artifacts?: string[]
    }

    try {
      parsedContent = JSON.parse(request.content)
    } catch {
      throw new ValidationException('Content must be valid JSON for result mode', 'content')
    }

    const agentActions: string[] = [
      `Gatekeeper: identified as execution result (${parsedContent.outcome ?? 'completed'})`,
    ]

    // Persist: update daily plan item with actual duration
    const planItem = await prisma.dailyPlanItem.findFirst({
      where: {
        task_id: request.parent_id,
        plan: { user_id: request.userId },
      },
      orderBy: { created_at: 'desc' },
    })

    if (parsedContent.actual_duration_minutes) {
      if (planItem) {
        await prisma.dailyPlanItem.update({
          where: { id: planItem.id },
          data: {
            actual_minutes: parsedContent.actual_duration_minutes,
          },
        })
      }
      agentActions.push(
        `Coach: recorded actual time ${parsedContent.actual_duration_minutes}min`,
      )
    }

    if (parsedContent.notes) {
      agentActions.push('Librarian: archived notes')
    }

    const areaName = parentTask.product?.area?.name ?? 'Unknown'
    const productName = parentTask.product?.name ?? 'Unknown'

    return {
      id: randomUUID(),
      status: 'processed',
      classified_as: 'result',
      filed_to: {
        area: areaName,
        product: productName,
      },
      parent_id: request.parent_id,
      agent_actions: agentActions,
    }
  }

  private parseContextHint(hint?: string): CaptureResponse['filed_to'] {
    if (!hint) {
      return { area: 'Inbox', product: 'Unsorted' }
    }

    const parts = hint.split('/')
    return {
      area: parts[0] || 'Inbox',
      product: parts[1] || 'Unsorted',
      topic: parts[2] || undefined,
    }
  }
}
