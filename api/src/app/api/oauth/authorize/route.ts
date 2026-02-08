/**
 * GET /api/oauth/authorize
 *
 * 開始 OAuth 授權流程（重定向到 OAuth Provider）
 *
 * Query Parameters:
 * - provider: OAuth Provider (e.g., 'google_calendar')
 *
 * Response:
 * - 302 Redirect 到 OAuth Provider 授權頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { OAuthService } from '@/lib/oauth-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
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

    // 生成授權 URL
    const authUrl = await oauthService.generateAuthorizationUrl(
      provider as any,
      userId
    )

    // 重定向到 OAuth Provider
    return NextResponse.redirect(authUrl)
  } catch (error) {
    if (error instanceof ValidationException) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('OAuth authorize error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
