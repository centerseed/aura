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
  const params = input as unknown as CaptureInput
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
