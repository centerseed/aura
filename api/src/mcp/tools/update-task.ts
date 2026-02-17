/**
 * update_task Tool Handler
 *
 * MCP Tool: update_task
 * 更新任務狀態 — 修改任務的 status 或 content。
 *
 * Required Scope: write:inbox
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface UpdateTaskInput {
  task_id: string
  status?: string
  content?: string
}

export async function handleUpdateTask(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as unknown as UpdateTaskInput

  const result = await apiClient.updateTask(authContext.userId, {
    task_id: params.task_id,
    status: params.status,
    content: params.content,
  }) as { id: string; title?: string; status?: string }

  return {
    id: result.id,
    title: result.title,
    status: result.status,
    message: 'Task updated successfully',
  }
}
