/**
 * DeleteAreaUseCase - 刪除領域
 */

import { prisma } from '@/lib/db'
import { ValidationException, NotFoundException, ConflictException } from '@/lib/api-response'

export interface DeleteAreaRequest {
  areaId: string
  userId: string
}

export interface DeleteAreaResponse {
  areaId: string
  message: string
}

export class DeleteAreaUseCase {
  async execute(request: DeleteAreaRequest): Promise<DeleteAreaResponse> {
    if (!request.areaId || !request.userId) {
      throw new ValidationException('Area ID and User ID are required', 'areaId')
    }

    // 使用 _count 避免載入完整 products 記錄
    const existing = await prisma.area.findFirst({
      where: { id: request.areaId, user_id: request.userId, deleted_at: null },
      select: {
        id: true,
        _count: {
          select: {
            products: { where: { deleted_at: null } },
          },
        },
      },
    })

    if (!existing) {
      throw new NotFoundException('Area')
    }

    if (existing._count.products > 0) {
      throw new ConflictException(
        `Cannot delete area with existing products. This area has ${existing._count.products} product(s). Please delete or move them first.`
      )
    }

    await prisma.area.update({
      where: { id: request.areaId },
      data: { deleted_at: new Date() },
    })

    return { areaId: request.areaId, message: 'Area deleted successfully' }
  }
}
