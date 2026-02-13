/**
 * capture Tool Handler (replaces capture_thought)
 *
 * MCP Tool: capture
 * 統一入口 — 支援 thought / execution_plan / result 三種模式。
 *
 * Required Scope: write:inbox
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'
import { CaptureUseCase, type CaptureMode } from '@/application/use-cases/mcp/capture'

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
  const useCase = new CaptureUseCase()

  const result = await useCase.execute({
    userId: authContext.userId,
    content: params.content,
    source: params.source,
    mode: params.mode ?? 'thought',
    parent_id: params.parent_id,
    context_hint: params.context_hint,
  })

  if (sanitized) {
    result._warning = 'content_sanitized'
  }

  return result
}
