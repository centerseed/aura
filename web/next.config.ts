import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用 standalone 模式用於 Docker/Cloud Run 部署
  output: 'standalone',

  // 啟用實驗性功能
  experimental: {
    // 支援 Server Actions
  },

  // CORS 配置
  async headers() {
    return [
      {
        // 匹配所有 API 路由
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" }, // 在生產環境建議替換為具體域名
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
