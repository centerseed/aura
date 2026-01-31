/**
 * UpdateEvaluationLogUseCase - 更新評估日誌
 *
 * Application Layer Use Case
 * 更新評估日誌的狀態和元數據
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface UpdateEvaluationLogRequest {
  logId: string
  userAction: 'PENDING' | 'APPLIED' | 'CANCELLED' | 'EDITED'
  metadata?: any
}

export interface UpdateEvaluationLogResponse {
  log: {
    id: string
    user_id: string
    type: string
    input_content: any
    output_content: any
    user_action: string
    metadata: any
    created_at: Date
  }
  message: string
}

// ============================================================================
// Use Case
// ============================================================================

export class UpdateEvaluationLogUseCase {
  async execute(
    request: UpdateEvaluationLogRequest
  ): Promise<UpdateEvaluationLogResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 更新 Log
    const updateData: any = {
      user_action: request.userAction,
    }

    if (request.metadata !== undefined) {
      updateData.metadata = request.metadata
    }

    const log = await prisma.systemEvaluationLog.update({
      where: { id: request.logId },
      data: updateData,
    })

    return {
      log,
      message: 'Evaluation log updated successfully',
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: UpdateEvaluationLogRequest): void {
    if (!request.logId) {
      throw new ValidationException('Log ID is required', 'logId')
    }

    if (!request.userAction) {
      throw new ValidationException('User action is required', 'userAction')
    }

    const validActions = ['PENDING', 'APPLIED', 'CANCELLED', 'EDITED']
    if (!validActions.includes(request.userAction)) {
      throw new ValidationException(
        `User action must be one of: ${validActions.join(', ')}`,
        'userAction'
      )
    }
  }
}
