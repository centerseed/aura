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
  product?: { name?: string } | string
  estimated_minutes?: number
  completed?: boolean
  task_id?: string
  [key: string]: unknown
}

interface ApiResponse {
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
  })

  // 驗證 API 回應格式
  if (!data || typeof data !== 'object') {
    console.error('[get_plan] API returned invalid response:', data)
    return {
      date: params.date || new Date().toISOString().split('T')[0],
      coach_message: 'No plan available',
      items: [],
      total: 0,
    }
  }

  // API 回傳格式：{ date, coach_message, items: [{ product: { name }, ... }] }
  const apiResponse = data as ApiResponse

  const items = (apiResponse.items ?? []).map((item: PlanItem) => ({
    content: item.content,
    product: typeof item.product === 'object' ? item.product?.name : item.product,
    estimated_minutes: item.estimated_minutes,
    completed: item.completed,
    task_id: item.task_id,
  }))

  return {
    date: apiResponse.date || params.date || new Date().toISOString().split('T')[0],
    coach_message: apiResponse.coach_message || 'No message available',
    items,
    total: items.length,
  }
}
