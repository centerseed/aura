/**
 * create_task Tool Handler
 *
 * MCP Tool: create_task
 * 建立開發代辦 — 透過 API 建立新任務。
 *
 * Required Scope: write:inbox
 */

import { ValidationException } from '@/lib/api-response'
import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

export interface CreateTaskInput {
  content: string
  product_id?: string
  topic_id?: string
  status?: string
  start_date?: string
  due_date?: string
  narrative?: string
}

export async function handleCreateTask(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  _sanitized: boolean,
) {
  // 驗證並轉換參數
  const params = validateCreateTaskInput(input)

  const result = await apiClient.createTask(authContext.userId, {
    content: params.content,
    product_id: params.product_id,
    topic_id: params.topic_id,
    status: params.status,
    start_date: params.start_date,
    due_date: params.due_date,
    narrative: params.narrative,
  }) as { task: { id: string; title?: string; status?: string }; message?: string }

  return {
    id: result.task.id,
    title: result.task.title,
    status: result.task.status,
    message: result.message || 'Task created successfully',
  }
}

/**
 * 驗證 create_task 的輸入參數
 */
function validateCreateTaskInput(
  input: Record<string, unknown>,
): CreateTaskInput {
  // 驗證 content（必填）
  if (!input.content || typeof input.content !== 'string') {
    throw new ValidationException(
      'content is required and must be a string',
      'content',
    )
  }

  if (input.content.trim().length === 0) {
    throw new ValidationException(
      'content cannot be empty or contain only whitespace',
      'content',
    )
  }

  if (input.content.length > 300) {
    throw new ValidationException(
      'content must not exceed 300 characters. Consider using add_reference for longer content.',
      'content',
    )
  }

  // 驗證 product_id（可選）
  if (input.product_id !== undefined && typeof input.product_id !== 'string') {
    throw new ValidationException('product_id must be a string', 'product_id')
  }

  // 驗證 topic_id（可選）
  if (input.topic_id !== undefined && typeof input.topic_id !== 'string') {
    throw new ValidationException('topic_id must be a string', 'topic_id')
  }

  // 驗證 status（可選）
  if (input.status !== undefined && typeof input.status !== 'string') {
    throw new ValidationException('status must be a string', 'status')
  }

  // 驗證 start_date（可選）
  if (input.start_date !== undefined && typeof input.start_date !== 'string') {
    throw new ValidationException('start_date must be a string', 'start_date')
  }
  if (input.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.start_date as string)) {
    throw new ValidationException('start_date must be in YYYY-MM-DD format', 'start_date')
  }

  // 驗證 due_date（可選）
  if (input.due_date !== undefined && typeof input.due_date !== 'string') {
    throw new ValidationException('due_date must be a string', 'due_date')
  }
  if (input.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date as string)) {
    throw new ValidationException('due_date must be in YYYY-MM-DD format', 'due_date')
  }

  // 驗證 narrative（可選）
  if (input.narrative !== undefined && typeof input.narrative !== 'string') {
    throw new ValidationException('narrative must be a string', 'narrative')
  }

  return {
    content: input.content as string,
    product_id: input.product_id ? (input.product_id as string) : undefined,
    topic_id: input.topic_id ? (input.topic_id as string) : undefined,
    status: input.status ? (input.status as string) : undefined,
    start_date: input.start_date ? (input.start_date as string) : undefined,
    due_date: input.due_date ? (input.due_date as string) : undefined,
    narrative: input.narrative ? (input.narrative as string) : undefined,
  }
}
