/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only mode
  reactStrictMode: true,

  // Output standalone for deployment
  output: 'standalone',

  // Optimize for API routes only
  serverExternalPackages: ['@prisma/client', 'firebase-admin'],

  // No need for image optimization in API server
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
