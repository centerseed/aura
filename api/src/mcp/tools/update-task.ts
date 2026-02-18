/**
 * update_task Tool Handler
 *
 * MCP Tool: update_task
 * 更新任務狀態 — 修改任務的 status 或 content。
 *
 * Required Scope: write:inbox
 */

import { ValidationException } from '@/lib/api-response'
import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface UpdateTaskInput {
  task_id: string
  status?: string
  content?: string
  start_date?: string | null
  due_date?: string | null
}

export async function handleUpdateTask(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  // 驗證並轉換參數
  const params = validateUpdateTaskInput(input)

  const result = await apiClient.updateTask(authContext.userId, {
    task_id: params.task_id,
    status: params.status,
    content: params.content,
    start_date: params.start_date,
    due_date: params.due_date,
  }) as { task: { id: string; title?: string; status?: string }; message?: string }

  return {
    id: result.task.id,
    title: result.task.title,
    status: result.task.status,
    message: result.message || 'Task updated successfully',
  }
}

/**
 * 驗證 update_task 的輸入參數
 */
function validateUpdateTaskInput(
  input: Record<string, unknown>,
): UpdateTaskInput {
  // 驗證 task_id
  if (!input.task_id || typeof input.task_id !== 'string') {
    throw new ValidationException(
      'task_id is required and must be a string',
      'task_id',
    )
  }

  // 驗證至少有 status、content、start_date 或 due_date 其中之一
  const hasStatus = input.status && typeof input.status === 'string'
  const hasContent = input.content && typeof input.content === 'string'
  const hasStartDate = input.start_date !== undefined
  const hasDueDate = input.due_date !== undefined

  if (!hasStatus && !hasContent && !hasStartDate && !hasDueDate) {
    throw new ValidationException(
      'At least one of status, content, start_date, or due_date must be provided.',
      'status|content|start_date|due_date',
    )
  }

  // 驗證 status 型別（如果提供）
  if (input.status !== undefined && typeof input.status !== 'string') {
    throw new ValidationException('status must be a string', 'status')
  }

  // 驗證 content 型別（如果提供）
  if (input.content !== undefined && typeof input.content !== 'string') {
    throw new ValidationException('content must be a string', 'content')
  }

  // 驗證 start_date（可選，null 表示清除）
  if (input.start_date !== null && input.start_date !== undefined && typeof input.start_date !== 'string') {
    throw new ValidationException('start_date must be a string in YYYY-MM-DD format or null', 'start_date')
  }
  if (typeof input.start_date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) {
    throw new ValidationException('start_date must be in YYYY-MM-DD format', 'start_date')
  }

  // 驗證 due_date（可選，null 表示清除）
  if (input.due_date !== null && input.due_date !== undefined && typeof input.due_date !== 'string') {
    throw new ValidationException('due_date must be a string in YYYY-MM-DD format or null', 'due_date')
  }
  if (typeof input.due_date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
    throw new ValidationException('due_date must be in YYYY-MM-DD format', 'due_date')
  }

  return {
    task_id: input.task_id as string,
    status: hasStatus ? (input.status as string) : undefined,
    content: hasContent ? (input.content as string) : undefined,
    start_date: hasStartDate ? (input.start_date as string | null) : undefined,
    due_date: hasDueDate ? (input.due_date as string | null) : undefined,
  }
}
