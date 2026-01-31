/**
 * UpdateAreaUseCase - 更新領域
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException } from '@/lib/api-response'

export interface UpdateAreaRequest {
  areaId: string
  userId: string
  name?: string
  scope?: string
  description?: string
}

export interface AreaData {
  id: string
  user_id: string
  name: string
  scope: string | null
  description: string | null
  is_custom: boolean
  created_at: Date
  updated_at: Date
}

export interface UpdateAreaResponse {
  area: AreaData
  message: string
}

export class UpdateAreaUseCase {
  async execute(request: UpdateAreaRequest): Promise<UpdateAreaResponse> {
    if (!request.areaId || !request.userId) {
      throw new ValidationException('Area ID and User ID are required', 'areaId')
    }

    const existing = await prisma.area.findFirst({
      where: { id: request.areaId, user_id: request.userId, deleted_at: null },
    })

    if (!existing) {
      throw new NotFoundException('Area')
    }

    if (request.name && request.name !== existing.name) {
      const duplicate = await prisma.area.findFirst({
        where: {
          user_id: existing.user_id,
          name: request.name,
          deleted_at: null,
          id: { not: request.areaId },
        },
      })
      if (duplicate) {
        throw new ValidationException('Area with this name already exists', 'name')
      }
    }

    const updated = await prisma.area.update({
      where: { id: request.areaId },
      data: { name: request.name, scope: request.scope, description: request.description },
    })

    return { area: updated, message: 'Area updated successfully' }
  }
}
