/**
 * add_sub_item Tool Handler
 *
 * MCP Tool: add_sub_item
 * 新增子任務 — 為指定任務新增子項目。
 *
 * Required Scope: write:inbox
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface AddSubItemInput {
  task_id: string
  content: string
}

export async function handleAddSubItem(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as unknown as AddSubItemInput

  if (!params.task_id) {
    return { error: 'task_id is required' }
  }
  if (!params.content || params.content.trim().length === 0) {
    return { error: 'content is required' }
  }

  const data = await apiClient.addSubItem(authContext.userId, params.task_id, params.content)

  return data
}
