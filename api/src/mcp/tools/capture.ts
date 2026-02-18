/**
 * capture Tool Handler (replaces capture_thought)
 *
 * MCP Tool: capture
 * 統一入口 — 支援 thought / execution_plan / result 三種模式。
 *
 * thought mode → delegates to brain-dump pipeline (apiClient.captureThought)
 *   for full AI classification + DB persistence.
 * execution_plan / result → handled by CaptureUseCase with direct DB writes.
 *
 * Required Scope: write:inbox
 */

import { ValidationException } from '@/lib/api-response'
import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'
import { CaptureUseCase, type CaptureMode, type CaptureResponse } from '@/application/use-cases/mcp/capture'

export interface CaptureInput {
  content: string
  source: string
  mode?: CaptureMode
  parent_id?: string
  context_hint?: string
}

export async function handleCapture(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
) {
  // 驗證並轉換參數
  const params = validateCaptureInput(input)
  const mode = params.mode ?? 'thought'

  let result: CaptureResponse

  if (mode === 'thought') {
    // Delegate to existing brain-dump pipeline (full AI classification + persistence)
    const backendResponse = await apiClient.captureThought(authContext.userId, {
      content: params.content,
      source: params.source,
      context_hint: params.context_hint,
    })

    result = {
      id: backendResponse.id,
      status: 'processed',
      classified_as: 'thought',
      filed_to: { area: 'auto-classified', product: 'auto-classified' },
      parent_id: null,
      agent_actions: [
        'Gatekeeper: classified via brain-dump pipeline',
        'Librarian: auto-filed based on AI analysis',
      ],
    }
  } else {
    // execution_plan and result modes handled by CaptureUseCase
    const useCase = new CaptureUseCase()
    result = await useCase.execute({
      userId: authContext.userId,
      content: params.content,
      source: params.source,
      mode,
      parent_id: params.parent_id,
      context_hint: params.context_hint,
    })
  }

  if (sanitized) {
    result._warning = 'content_sanitized'
  }

  return result
}

/**
 * 驗證 capture 的輸入參數
 */
function validateCaptureInput(
  input: Record<string, unknown>,
): CaptureInput {
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

  // 驗證 source（可選，預設 mcp-client）
  if (input.source !== undefined && typeof input.source !== 'string') {
    throw new ValidationException(
      'source must be a string (e.g., "mcp", "web", "mobile")',
      'source',
    )
  }

  // 驗證 mode（可選，但必須是有效值）
  if (input.mode !== undefined) {
    if (typeof input.mode !== 'string') {
      throw new ValidationException('mode must be a string', 'mode')
    }
    if (!['thought', 'execution_plan', 'result'].includes(input.mode)) {
      throw new ValidationException(
        'mode must be one of: "thought", "execution_plan", or "result"',
        'mode',
      )
    }
  }

  // 驗證 parent_id（可選）
  if (input.parent_id !== undefined && typeof input.parent_id !== 'string') {
    throw new ValidationException('parent_id must be a string', 'parent_id')
  }

  // 驗證 context_hint（可選）
  if (input.context_hint !== undefined && typeof input.context_hint !== 'string') {
    throw new ValidationException('context_hint must be a string', 'context_hint')
  }

  return {
    content: input.content as string,
    source: input.source as string,
    mode: input.mode as CaptureMode | undefined,
    parent_id: input.parent_id as string | undefined,
    context_hint: input.context_hint as string | undefined,
  }
}
