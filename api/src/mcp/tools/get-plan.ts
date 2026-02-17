/**
 * get_plan Tool Handler
 *
 * MCP Tool: get_plan
 * 取得今日 Coach 計畫 — 回傳精簡版計畫。
 *
 * Required Scope: read:tasks
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface GetPlanInput {
  date?: string
}

interface PlanItem {
  content?: string
  product?: { name: string }
  estimated_minutes?: number
  completed?: boolean
  task_id?: string
  [key: string]: unknown
}

interface PlanData {
  date?: string
  coach_message?: string
  items?: PlanItem[]
  [key: string]: unknown
}

export async function handleGetPlan(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as unknown as GetPlanInput

  const data = await apiClient.getPlan(authContext.userId, {
    date: params.date,
  }) as PlanData

  const items = (data.items ?? []).map((item: PlanItem) => ({
    content: item.content,
    product: item.product?.name,
    estimated_minutes: item.estimated_minutes,
    completed: item.completed,
    task_id: item.task_id,
  }))

  return {
    date: data.date,
    coach_message: data.coach_message,
    items,
    total: items.length,
  }
}
