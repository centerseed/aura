/**
 * report_done Tool Handler
 *
 * MCP Tool: report_done
 * 報告行動項目完成，Coach 計算偏差 + Librarian 歸檔。
 *
 * Required Scope: write:inbox
 */

import { ValidationException } from '@/lib/api-response'
import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'
import { ReportDoneUseCase } from '@/application/use-cases/mcp/report-done'

export interface ReportDoneInput {
  action_id: string
  actual_duration_minutes?: number
  outcome?: 'completed' | 'partial' | 'blocked' | 'cancelled'
  notes?: string
}

export async function handleReportDone(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
) {
  // 驗證並轉換參數
  const params = validateReportDoneInput(input)
  const useCase = new ReportDoneUseCase()

  return useCase.execute({
    userId: authContext.userId,
    actionId: params.action_id,
    actualDurationMinutes: params.actual_duration_minutes,
    outcome: params.outcome,
    notes: params.notes,
  })
}

/**
 * 驗證 report_done 的輸入參數
 */
function validateReportDoneInput(
  input: Record<string, unknown>,
): ReportDoneInput {
  // 驗證 action_id（必填）
  if (!input.action_id || typeof input.action_id !== 'string') {
    throw new ValidationException(
      'action_id is required and must be a string',
      'action_id',
    )
  }

  // 驗證 actual_duration_minutes（可選，但必須是數字）
  if (input.actual_duration_minutes !== undefined) {
    if (typeof input.actual_duration_minutes !== 'number') {
      throw new ValidationException(
        'actual_duration_minutes must be a number',
        'actual_duration_minutes',
      )
    }
    if (input.actual_duration_minutes < 0) {
      throw new ValidationException(
        'actual_duration_minutes must be a non-negative number',
        'actual_duration_minutes',
      )
    }
  }

  // 驗證 outcome（可選，但必須是有效值）
  if (input.outcome !== undefined) {
    if (typeof input.outcome !== 'string') {
      throw new ValidationException('outcome must be a string', 'outcome')
    }
    const validOutcomes = ['completed', 'partial', 'blocked', 'cancelled']
    if (!validOutcomes.includes(input.outcome)) {
      throw new ValidationException(
        `outcome must be one of: ${validOutcomes.join(', ')}`,
        'outcome',
      )
    }
  }

  // 驗證 notes（可選）
  if (input.notes !== undefined && typeof input.notes !== 'string') {
    throw new ValidationException('notes must be a string', 'notes')
  }

  return {
    action_id: input.action_id as string,
    actual_duration_minutes: input.actual_duration_minutes as number | undefined,
    outcome: input.outcome as 'completed' | 'partial' | 'blocked' | 'cancelled' | undefined,
    notes: input.notes as string | undefined,
  }
}
