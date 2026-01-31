/**
 * CreateAreaUseCase - 創建領域
 */

import { prisma } from '@/lib/db'
import { ValidationException, ConflictException } from '@/lib/api-response'

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
    // 驗證必填欄位
    if (!request.userId || !request.name) {
      throw new ValidationException('User ID and name are required', 'name')
    }

    // 驗證 name 長度
    if (request.name.length > 50) {
      throw new ValidationException('Name must be 50 characters or less', 'name')
    }

    // 驗證 scope 不能為空字串（如果有提供）
    if (request.scope !== undefined && request.scope === '') {
      throw new ValidationException('Scope cannot be empty', 'scope')
    }

    // 檢查名稱是否已存在
    const existing = await prisma.area.findFirst({
      where: { user_id: request.userId, name: request.name, deleted_at: null },
    })

    if (existing) {
      throw new ConflictException('Area with this name already exists')
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
