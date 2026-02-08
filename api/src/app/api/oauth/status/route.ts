/**
 * GET /api/oauth/status
 *
 * 檢查 OAuth 授權狀態
 *
 * Query Parameters:
 * - provider: OAuth Provider (e.g., 'google_calendar')
 *
 * Response:
 * {
 *   "authorized": boolean,
 *   "provider": string,
 *   "authorized_email": string | null,
 *   "scopes": string[],
 *   "expires_at": string | null,
 *   "auth_url": string | null  // 如果未授權，提供授權 URL
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { OAuthService } from '@/lib/oauth-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 認證
    const userId = await authenticateRequest(request, prisma)

    // 取得 provider 參數
    const searchParams = request.nextUrl.searchParams
    const providerParam = searchParams.get('provider')

    if (!providerParam) {
      throw new ValidationException('Missing provider parameter', 'provider')
    }

    // 轉換為大寫並驗證
    const provider = providerParam.toUpperCase().replace(/-/g, '_')
    const validProviders = ['GOOGLE_CALENDAR', 'GOOGLE_DRIVE', 'ZOOM']

    if (!validProviders.includes(provider)) {
      throw new ValidationException(`Invalid provider: ${providerParam}`, 'provider')
    }

    const oauthService = new OAuthService(prisma)

    // 檢查授權狀態
    const status = await oauthService.getAuthorizationStatus(
      userId,
      provider as any
    )

    // 如果未授權，生成授權 URL
    let authUrl = null
    if (!status.authorized) {
      authUrl = await oauthService.generateAuthorizationUrl(
        provider as any,
        userId
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        authorized: status.authorized,
        provider: providerParam,
        authorized_email: status.authorized_email,
        scopes: status.scopes,
        expires_at: status.expires_at?.toISOString() || null,
        auth_url: authUrl,
      },
    })
  })
}
