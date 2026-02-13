/**
 * report_done Tool Handler
 *
 * MCP Tool: report_done
 * 報告行動項目完成，Coach 計算偏差 + Librarian 歸檔。
 *
 * Required Scope: write:inbox
 */

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
  const params = input as unknown as ReportDoneInput
  const useCase = new ReportDoneUseCase()

  return useCase.execute({
    userId: authContext.userId,
    actionId: params.action_id,
    actualDurationMinutes: params.actual_duration_minutes,
    outcome: params.outcome,
    notes: params.notes,
  })
}
