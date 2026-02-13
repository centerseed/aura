/**
 * GetAreasHierarchyUseCase - 用戶領域結構
 *
 * MCP Resource: zentropy://areas
 * 查詢 Area→Product→Topic 階層結構，含 active_actions 計數。
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

export interface GetAreasHierarchyRequest {
  userId: string
}

export interface AreasProductData {
  name: string
  topics: string[]
  active_actions: number
  status: string
}

export interface AreasAreaData {
  name: string
  products: AreasProductData[]
}

export interface GetAreasHierarchyResponse {
  areas: AreasAreaData[]
}

export class GetAreasHierarchyUseCase {
  async execute(request: GetAreasHierarchyRequest): Promise<GetAreasHierarchyResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    const areas = await prisma.area.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            topics: {
              where: { deleted_at: null },
              select: { id: true, name: true },
            },
            _count: {
              select: {
                tasks: {
                  where: {
                    deleted_at: null,
                    status: { in: ['ACTIVE', 'INBOX'] },
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'asc' },
    })

    return {
      areas: areas.map(area => ({
        name: area.name,
        products: area.products.map(product => ({
          name: product.name,
          topics: product.topics.map(t => t.name),
          active_actions: product._count.tasks,
          status: (product.status || 'active').toLowerCase(),
        })),
      })),
    }
  }
}
