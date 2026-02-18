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
  product_id?: string
  topic_id?: string
  include_sub_items?: boolean
}

interface TaskItem {
  id: string
  title?: string
  status?: string
  tag?: { area?: string; product?: string; topic?: string }
  due_date?: string
  sub_items?: Array<{ id: string; content: string; completed: boolean }>
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
    product_id: params.product_id,
    topic_id: params.topic_id,
  })

  // 驗證 API 回應格式
  if (!data) {
    console.error('[list_tasks] API returned null or undefined')
    return { tasks: [], total: 0 }
  }

  let tasks: TaskItem[]
  if (Array.isArray(data)) {
    tasks = data
  } else if (typeof data === 'object' && 'tasks' in data && Array.isArray(data.tasks)) {
    tasks = data.tasks
  } else {
    console.error('[list_tasks] Unexpected API response format:', typeof data)
    return { tasks: [], total: 0 }
  }

  // Return slim version for Claude Code context efficiency
  const slim = tasks.map((t: TaskItem) => {
    const base = {
      id: t.id,
      title: t.title,
      status: t.status,
      area: t.tag?.area,
      product: t.tag?.product,
      topic: t.tag?.topic,
      due_date: t.due_date,
      sub_items_progress: t.sub_items
        ? `${t.sub_items.filter((s) => s.completed === true).length}/${t.sub_items.length}`
        : undefined,
    }

    if (params.include_sub_items && t.sub_items) {
      return {
        ...base,
        sub_items: t.sub_items.map((s) => ({
          id: s.id,
          content: s.content,
          completed: s.completed,
        })),
      }
    }

    return base
  })

  return { tasks: slim, total: slim.length }
}
