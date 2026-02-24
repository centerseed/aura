import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * CORS Middleware - 允許跨域請求
 *
 * 在開發環境中允許來自 localhost:3001 (Web) 的請求
 * 在生產環境中可以設定特定的域名
 */
// 已知的爬蟲 User-Agent 關鍵字
const BOT_PATTERNS = [
  'Googlebot', 'bingbot', 'Baiduspider', 'YandexBot',
  'DuckDuckBot', 'Slurp', 'facebookexternalhit', 'Twitterbot',
  'rogerbot', 'linkedinbot', 'embedly', 'showyoubot',
  'outbrain', 'pinterest', 'applebot', 'SemrushBot',
  'AhrefsBot', 'MJ12bot', 'DotBot', 'PetalBot',
]

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some(bot => ua.includes(bot.toLowerCase()))
}

export function middleware(request: NextRequest) {
  // 🛡️ Bot 防護：無認證的爬蟲請求直接拒絕
  // 跳過條件：有 Authorization header、或公開端點（health check 等）
  const pathname = request.nextUrl.pathname
  const isPublicEndpoint = pathname === '/api/health'
  const hasAuth = request.headers.has('authorization')
  if (!hasAuth && !isPublicEndpoint && isBot(request.headers.get('user-agent'))) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  // 允許的來源 (origins)
  const allowedOrigins = [
    'http://localhost:3001', // 本地開發 Web
    'http://localhost:3000', // 備用端口
    'https://zentropy-4f7a5.web.app', // Firebase Hosting
    'https://zentropy-4f7a5.firebaseapp.com', // Firebase 備用域名
    'https://zentropy.cc', // 自訂網域
    'https://www.zentropy.cc', // 自訂網域 (www)
  ]

  // 如果有設定生產環境的前端 URL，也加入允許清單
  if (process.env.NEXT_PUBLIC_WEB_URL) {
    allowedOrigins.push(process.env.NEXT_PUBLIC_WEB_URL)
  }

  const origin = request.headers.get('origin')

  // 開發環境：允許所有 localhost 來源（任意端口）
  const isLocalhost = origin?.match(/^http:\/\/localhost(:\d+)?$/)
  const isAllowedOrigin = origin && (allowedOrigins.includes(origin) || isLocalhost)

  // 處理 CORS preflight 請求 (OPTIONS)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })

    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }

    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    )
    response.headers.set('Access-Control-Max-Age', '86400') // 24小時

    return response
  }

  // 處理實際請求
  const response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    )
  }

  return response
}

/**
 * 設定 Middleware 匹配規則
 * 只對 /api/* 路徑套用 CORS
 */
export const config = {
  matcher: '/api/:path*',
}
