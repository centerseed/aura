/**
 * User Statistics API Route
 * GET /api/me/statistics - 獲取當前用戶的統計數據
 */

import { NextRequest } from 'next/server'
import { getAuth } from '@/lib/firebase-admin'
import {
  ApiResponseBuilder,
  catchDomainException,
  UnauthorizedException,
} from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { Status as PrismaStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 驗證 Firebase ID Token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.substring(7)
    const auth = getAuth()
    let decodedToken
    try {
      decodedToken = await auth.verifyIdToken(token)
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token')
    }
    const firebaseUid = decodedToken.uid

    // 查詢或創建用戶
    let user = await prisma.user.findFirst({
      where: {
        auth_provider_id: firebaseUid,
        deleted_at: null,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // 計算今日的開始和結束時間
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    // 並行查詢所有統計數據
    const [
      totalTasks,
      totalProducts,
      totalAreas,
      activeTasks,
      archivedTasks,
      completedToday,
    ] = await Promise.all([
      prisma.task.count({
        where: { user_id: user.id, deleted_at: null },
      }),
      prisma.product.count({
        where: { user_id: user.id, deleted_at: null },
      }),
      prisma.area.count({
        where: { user_id: user.id, deleted_at: null },
      }),
      prisma.task.count({
        where: {
          user_id: user.id,
          deleted_at: null,
          status: PrismaStatus.ACTIVE,
        },
      }),
      prisma.task.count({
        where: {
          user_id: user.id,
          deleted_at: null,
          status: PrismaStatus.ARCHIVE,
        },
      }),
      prisma.task.count({
        where: {
          user_id: user.id,
          deleted_at: null,
          status: PrismaStatus.ARCHIVE,
          updated_at: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
      }),
    ])

    // 計算使用天數
    const daysActive = Math.floor(
      (Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24)
    )

    return ApiResponseBuilder.success(
      {
        statistics: {
          totalTasks,
          totalProducts,
          totalAreas,
          daysActive,
          activeTasks,
          archivedTasks,
          completedToday,
        },
      },
      {}
    )
  })
}
