/**
 * create_task Tool Handler
 *
 * MCP Tool: create_task
 * 建立開發代辦 — 透過 API 建立新任務。
 *
 * Required Scope: write:inbox
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface CreateTaskInput {
  content: string
  product_id?: string
  topic_id?: string
  status?: string
  due_date?: string
}

export async function handleCreateTask(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as unknown as CreateTaskInput

  const result = await apiClient.createTask(authContext.userId, {
    content: params.content,
    product_id: params.product_id,
    topic_id: params.topic_id,
    status: params.status,
    due_date: params.due_date,
  }) as { id: string; title?: string; status?: string }

  return {
    id: result.id,
    title: result.title,
    status: result.status,
    message: 'Task created successfully',
  }
}
