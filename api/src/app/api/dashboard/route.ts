/**
 * Dashboard API Route - 統一資料載入端點
 *
 * 整合多個 API 調用，在服務端使用 Promise.all 並發查詢
 * 解決瀏覽器對 Cloud Run HTTP/1.1 請求序列化的問題
 *
 * GET /api/dashboard?include=user,library,milestones,completedToday
 *
 * Query Parameters:
 * - include: 要載入的數據區塊（逗號分隔）
 *   - Web 預設: user,library,milestones,completedToday
 *   - Flutter 可用: areas,products,tasks,completedToday
 * - include_archived: 是否包含已歸檔任務（預設 false）
 * - tasks_status: 任務狀態過濾（用於 tasks 區塊）
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { prisma } from '@/lib/db'

// Use Cases
import { GetCurrentUserUseCase } from '@/application/use-cases/users/get-current-user'
import { GetLibraryUseCase } from '@/application/use-cases/library/get-library'
import { GetMilestonesUseCase } from '@/application/use-cases/milestones/get-milestones'
import { GetTasksUseCase } from '@/application/use-cases/tasks/get-tasks'
import { GetAreasUseCase } from '@/application/use-cases/areas/get-areas'
import { GetProductsUseCase } from '@/application/use-cases/products/get-products'

// ============================================================================
// Types
// ============================================================================

type DataSection =
  | 'user'
  | 'library'
  | 'milestones'
  | 'completedToday'
  | 'areas'
  | 'products'
  | 'tasks'

const WEB_DEFAULT_SECTIONS: DataSection[] = [
  'user',
  'library',
  'milestones',
  'completedToday',
]

// ============================================================================
// GET /api/dashboard
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 驗證用戶（支援測試模式）
    const userId = await authenticateRequest(request, prisma)

    // 2. 查詢用戶的 Firebase UID（GetCurrentUserUseCase 需要）
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { auth_provider_id: true },
    })
    const firebaseUid = userRecord?.auth_provider_id || userId

    // 3. 解析 Query Parameters
    const { searchParams } = new URL(request.url)
    const includeParam = searchParams.get('include')
    const includeArchived = searchParams.get('include_archived') === 'true'
    const tasksStatus = searchParams.get('tasks_status') || undefined

    // 4. 決定要載入哪些區塊
    const sections: Set<DataSection> = includeParam
      ? new Set(
          includeParam.split(',').map((s) => s.trim()) as DataSection[]
        )
      : new Set(WEB_DEFAULT_SECTIONS)

    // 5. 建立並發查詢 Promise
    const promises: Record<string, Promise<any>> = {}

    if (sections.has('user')) {
      const useCase = new GetCurrentUserUseCase()
      promises.user = useCase.execute({ firebaseUid })
    }

    if (sections.has('library')) {
      const useCase = new GetLibraryUseCase()
      promises.library = useCase.execute({ userId, includeArchived })
    }

    if (sections.has('milestones')) {
      const useCase = new GetMilestonesUseCase()
      promises.milestones = useCase.execute({ userId })
    }

    if (sections.has('completedToday')) {
      const useCase = new GetTasksUseCase()
      promises.completedToday = useCase.execute({
        userId,
        completedToday: true,
      })
    }

    if (sections.has('areas')) {
      const useCase = new GetAreasUseCase()
      promises.areas = useCase.execute({ userId })
    }

    if (sections.has('products')) {
      const useCase = new GetProductsUseCase()
      promises.products = useCase.execute({ userId })
    }

    if (sections.has('tasks')) {
      const useCase = new GetTasksUseCase()
      promises.tasks = useCase.execute({
        userId,
        status: tasksStatus,
      })
    }

    // 6. 並發執行所有查詢
    const keys = Object.keys(promises)
    const results = await Promise.all(Object.values(promises))

    // 7. 組裝回應
    const response: Record<string, any> = {}
    keys.forEach((key, index) => {
      const data = results[index]

      switch (key) {
        case 'user':
          // GetCurrentUserUseCase 回傳 { user: {...} }
          response.user = data.user
          break
        case 'library':
          // GetLibraryUseCase 回傳 { areas: [...] }
          response.library = data
          break
        case 'milestones':
          // GetMilestonesUseCase 回傳 { milestones: [...] }
          response.milestones = data.milestones
          break
        case 'completedToday':
          // GetTasksUseCase 回傳 { tasks: [...], meta: {...} }
          response.completedToday = {
            tasks: data.tasks,
            meta: data.meta,
          }
          break
        case 'areas':
          // GetAreasUseCase 回傳 { areas: [...] }
          response.areas = data.areas
          break
        case 'products':
          // GetProductsUseCase 回傳 { products: [...] }
          response.products = data.products
          break
        case 'tasks':
          // GetTasksUseCase 回傳 { tasks: [...], meta: {...} }
          response.tasks = {
            tasks: data.tasks,
            meta: data.meta,
          }
          break
      }
    })

    return ApiResponseBuilder.success(response, {
      sections: keys,
    })
  })
}
