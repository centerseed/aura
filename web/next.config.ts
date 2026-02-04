import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // ============================================================================
  // 部署模式: 靜態導出 (Firebase Hosting)
  // ============================================================================
  //
  // 使用 'export' 模式將 Next.js 編譯為靜態 HTML/CSS/JS
  // 部署到 Firebase Hosting (CDN) 獲得全球加速和免費額度
  //
  // 注意:
  // - 不支援 API Routes (所有 API 在獨立的 api/ 專案)
  // - 不支援 Server Actions
  // - 不支援 ISR (Incremental Static Regeneration)
  // - 不支援 getServerSideProps (使用 getStaticProps)
  //
  output: 'export',

  // ============================================================================
  // 開發環境 Headers (允許 eval 以支援 HMR)
  // ============================================================================
  //
  // 開發模式需要 eval() 來實現 Hot Module Replacement
  // 生產環境不會套用這些 headers
  //
  async headers() {
    if (!isDev) return [];
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "https://*.googleapis.com",
              "https://*.google.com",
              "https://*.firebaseapp.com",
              "https://*.googletagmanager.com",
            ].join(' ') + ';',
          },
        ],
      },
    ];
  },

  // ============================================================================
  // 圖片優化
  // ============================================================================
  //
  // 靜態導出不支援 Next.js 內建的 Image Optimization
  // 使用 unoptimized 跳過優化，或改用外部圖片服務 (Cloudinary, imgix)
  //
  images: {
    unoptimized: true,
  },

  // ============================================================================
  // Trailing Slash
  // ============================================================================
  //
  // Firebase Hosting 建議啟用 trailing slash 以配合 rewrites
  //
  trailingSlash: true,
};

export default nextConfig;
