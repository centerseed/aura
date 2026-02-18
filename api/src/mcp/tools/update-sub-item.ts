/**
 * update_sub_item Tool Handler
 *
 * MCP Tool: update_sub_item
 * 更新子任務 — 標記完成或修改子項目內容。
 *
 * Required Scope: write:inbox
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface UpdateSubItemInput {
  task_id: string
  sub_item_id: string
  completed?: boolean
  content?: string
}

export async function handleUpdateSubItem(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as unknown as UpdateSubItemInput

  if (!params.task_id) {
    return { error: 'task_id is required' }
  }
  if (!params.sub_item_id) {
    return { error: 'sub_item_id is required' }
  }
  if (params.completed === undefined && params.content === undefined) {
    return { error: 'At least one of completed or content must be provided' }
  }

  const data = await apiClient.updateSubItem(authContext.userId, params.task_id, params.sub_item_id, {
    completed: params.completed,
    content: params.content,
  })

  return data
}
