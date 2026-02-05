import { PrismaClient } from "@prisma/client";
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// 🛡️ 測試環境不允許連接生產資料庫
if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('supabase')) {
  throw new Error('測試環境禁止連接生產資料庫');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 🚀 Neon Serverless 優化
 *
 * 在 serverless 環境（Vercel/Cloud Run）使用 Neon adapter 減少冷啟動延遲
 * 本地開發時使用標準 Prisma client
 */
function createPrismaClient(): PrismaClient {
  const isServerless = process.env.VERCEL || process.env.K_SERVICE; // Vercel 或 Cloud Run
  const isNeonDb = process.env.DATABASE_URL?.includes('neon.tech');

  // 只在 serverless + Neon 環境啟用 adapter
  if (isServerless && isNeonDb) {
    // 啟用 WebSocket 支援（用於 Node.js 環境）
    neonConfig.webSocketConstructor = ws;

    const connectionString = process.env.DATABASE_URL!;
    // PrismaNeon 接收 PoolConfig，而非 Pool 實例
    const adapter = new PrismaNeon({ connectionString });

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  // 標準 Prisma client（本地開發或非 Neon 環境）
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
