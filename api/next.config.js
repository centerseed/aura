/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only mode
  reactStrictMode: true,

  // 不使用 standalone - standalone server 有並發阻塞問題
  // 參考: https://github.com/vercel/next.js/issues/64396
  // output: 'standalone',

  // Optimize for API routes only
  serverExternalPackages: ['@prisma/client', 'firebase-admin', 'naru-agent-js'],

  // No need for image optimization in API server
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
