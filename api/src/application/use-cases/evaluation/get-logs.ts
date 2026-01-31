/**
 * GetEvaluationLogsUseCase - 獲取評估日誌
 *
 * Application Layer Use Case
 * 獲取系統評估日誌列表,支援分頁和過濾
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetEvaluationLogsRequest {
  userId: string
  type?: string
  userAction?: string
  limit?: number
  offset?: number
}

export interface EvaluationLogData {
  id: string
  user_id: string
  type: string
  input_content: any
  output_content: any
  user_action: string
  metadata: any
  created_at: Date
  user: {
    id: string
    email: string | null
    name: string | null
  }
}

export interface GetEvaluationLogsResponse {
  total: number
  limit: number
  offset: number
  logs: EvaluationLogData[]
}

// ============================================================================
// Use Case
// ============================================================================

export class GetEvaluationLogsUseCase {
  async execute(
    request: GetEvaluationLogsRequest
  ): Promise<GetEvaluationLogsResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 設定預設值
    const limit = request.limit ?? 50
    const offset = request.offset ?? 0

    // 3. 構建查詢條件
    const where: any = {
      user_id: request.userId,
    }

    if (request.type) {
      where.type = request.type
    }

    if (request.userAction) {
      where.user_action = request.userAction
    }

    // 4. 查詢總數
    const total = await prisma.systemEvaluationLog.count({ where })

    // 5. 查詢資料
    const logs = await prisma.systemEvaluationLog.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return {
      total,
      limit,
      offset,
      logs,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetEvaluationLogsRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (request.limit !== undefined && (request.limit < 1 || request.limit > 100)) {
      throw new ValidationException('Limit must be between 1 and 100', 'limit')
    }

    if (request.offset !== undefined && request.offset < 0) {
      throw new ValidationException('Offset must be non-negative', 'offset')
    }
  }
}
