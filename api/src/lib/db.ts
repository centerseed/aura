import { PrismaClient } from "@prisma/client";

// 🛡️ 測試環境不允許連接生產資料庫
if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('supabase')) {
  throw new Error('測試環境禁止連接生產資料庫');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
