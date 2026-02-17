/**
 * list_tasks Tool Handler
 *
 * MCP Tool: list_tasks
 * 查看任務清單 — 回傳精簡版任務列表供 Claude Code 使用。
 *
 * Required Scope: read:tasks
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface ListTasksInput {
  status?: string
}

interface TaskItem {
  id: string
  title?: string
  status?: string
  area?: { id: string; name: string }
  product?: { id: string; name: string }
  topic?: { id: string; name: string }
  due_date?: string
  sub_items?: Array<{ id: string; title: string; status: string }>
  [key: string]: unknown
}

export async function handleListTasks(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const params = input as unknown as ListTasksInput

  const data = await apiClient.listTasks(authContext.userId, {
    status: params.status,
  }) as TaskItem[] | { tasks: TaskItem[] }

  const tasks = Array.isArray(data) ? data : (data.tasks ?? [])

  // Return slim version for Claude Code context efficiency
  const slim = tasks.map((t: TaskItem) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    area: t.area?.name,
    product: t.product?.name,
    topic: t.topic?.name,
    due_date: t.due_date,
    sub_items_progress: t.sub_items
      ? `${t.sub_items.filter((s) => s.status === 'DONE').length}/${t.sub_items.length}`
      : undefined,
  }))

  return { tasks: slim, total: slim.length }
}
