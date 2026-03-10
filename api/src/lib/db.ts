import { PrismaClient } from "@prisma/client";

// 🛡️ 測試環境不允許連接生產資料庫
if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('supabase')) {
  throw new Error('測試環境禁止連接生產資料庫');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Cloud Run 每個 instance 限制 1 條連線，避免多 instance 同時跑時耗盡 PostgreSQL 連線槽
function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url.includes('connection_limit=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=1&pool_timeout=20`;
}

export function isSingleConnectionPool(): boolean {
  const url = buildDatabaseUrl()
  return /(?:[?&])connection_limit=1(?:[&#]|$)/.test(url)
}

const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  datasources: {
    db: { url: buildDatabaseUrl() },
  },
});

export const prisma = globalForPrisma.prisma ?? prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
