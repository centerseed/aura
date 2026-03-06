/**
 * GetAreasUseCase - 獲取領域列表
 *
 * Application Layer Use Case  
 * 處理獲取用戶所有領域的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

export interface GetAreasRequest {
  userId: string
}

export interface AreaData {
  id: string
  user_id: string
  name: string
  scope: string | null
  description: string | null
  is_custom: boolean
  display_order: number
  created_at: Date
  updated_at: Date
}

export interface GetAreasResponse {
  areas: AreaData[]
}

export class GetAreasUseCase {
  async execute(request: GetAreasRequest): Promise<GetAreasResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    const areas = await prisma.area.findMany({
      where: { user_id: request.userId, deleted_at: null },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    })

    return { areas }
  }
}
