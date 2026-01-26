import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用 standalone 模式用於 Docker/Cloud Run 部署
  output: 'standalone',

  // 啟用實驗性功能
  experimental: {
    // 支援 Server Actions
  },
};

export default nextConfig;
