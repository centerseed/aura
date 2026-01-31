/**
 * CreateAreaUseCase - 創建領域
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

export interface CreateAreaRequest {
  userId: string
  name: string
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

export interface CreateAreaResponse {
  area: AreaData
  created: boolean
  updated: boolean
  message: string
}

export class CreateAreaUseCase {
  async execute(request: CreateAreaRequest): Promise<CreateAreaResponse> {
    if (!request.userId || !request.name) {
      throw new ValidationException('User ID and name are required', 'name')
    }

    const existing = await prisma.area.findFirst({
      where: { user_id: request.userId, name: request.name, deleted_at: null },
    })

    if (existing) {
      const updated = await prisma.area.update({
        where: { id: existing.id },
        data: { scope: request.scope, description: request.description || request.scope },
      })
      return { area: updated, created: false, updated: true, message: 'Area updated successfully' }
    }

    const area = await prisma.area.create({
      data: {
        user_id: request.userId,
        name: request.name,
        scope: request.scope,
        description: request.description || request.scope,
        is_custom: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    return { area, created: true, updated: false, message: 'Area created successfully' }
  }
}
