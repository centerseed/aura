/**
 * Remote Database Read-Only Tests
 *
 * ⚠️ 安全設計：
 * 1. 只允許 SELECT 查詢，絕對禁止 INSERT/UPDATE/DELETE
 * 2. 使用 Proxy 攔截所有寫入操作
 * 3. 測試失敗不會影響生產資料
 *
 * 目的：
 * - 驗證 Remote DB (Neon) 連接正常
 * - 驗證 Schema 與 Prisma Client 兼容
 * - 測試查詢性能（不影響資料）
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

// ==============================================================================
// 只讀 Prisma Client - 硬性阻擋所有寫入操作
// ==============================================================================

/**
 * 創建只讀 Prisma Client
 * 使用 Proxy 攔截所有可能的寫入操作
 */
function createReadOnlyPrismaClient(databaseUrl: string): PrismaClient {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  // 禁止的操作列表
  const FORBIDDEN_OPERATIONS = [
    "create",
    "createMany",
    "update",
    "updateMany",
    "upsert",
    "delete",
    "deleteMany",
    // Raw queries that might write
    "$executeRaw",
    "$executeRawUnsafe",
  ];

  // 創建 Proxy 來攔截所有模型操作
  const createModelProxy = (target: unknown, modelName: string) => {
    return new Proxy(target as object, {
      get(obj, prop) {
        const propName = String(prop);

        // 檢查是否是禁止的操作
        if (FORBIDDEN_OPERATIONS.includes(propName)) {
          return () => {
            throw new Error(
              `🚫 [SECURITY] WRITE OPERATION BLOCKED!\n` +
                `   Model: ${modelName}\n` +
                `   Operation: ${propName}\n` +
                `   This is a READ-ONLY connection to the remote database.\n` +
                `   Write operations are strictly forbidden.`
            );
          };
        }

        return (obj as Record<string, unknown>)[propName];
      },
    });
  };

  // 為每個模型創建 Proxy
  const handler: ProxyHandler<PrismaClient> = {
    get(target, prop) {
      const propName = String(prop);

      // 直接禁止 $executeRaw
      if (propName === "$executeRaw" || propName === "$executeRawUnsafe") {
        return () => {
          throw new Error(
            `🚫 [SECURITY] RAW EXECUTE BLOCKED!\n` +
              `   Operation: ${propName}\n` +
              `   Use $queryRaw for read-only queries instead.`
          );
        };
      }

      // 允許 $queryRaw（只讀）
      if (propName === "$queryRaw" || propName === "$queryRawUnsafe") {
        return (target as Record<string, unknown>)[propName];
      }

      // 允許連接管理
      if (propName === "$connect" || propName === "$disconnect") {
        return (target as Record<string, unknown>)[propName];
      }

      // 為模型創建 Proxy
      const value = (target as Record<string, unknown>)[propName];
      if (value && typeof value === "object") {
        return createModelProxy(value, propName);
      }

      return value;
    },
  };

  return new Proxy(prisma, handler);
}

// ==============================================================================
// 測試套件
// ==============================================================================

describe("Remote Database Read-Only Tests", () => {
  let prisma: PrismaClient;
  let remoteDbUrl: string | undefined;

  beforeAll(async () => {
    // 從 .env 讀取 remote DB URL
    // 注意：這裡使用生產/開發環境的 DATABASE_URL
    remoteDbUrl = process.env.DATABASE_URL_REMOTE || process.env.DATABASE_URL;

    if (!remoteDbUrl) {
      console.warn("⚠️ No remote database URL configured, skipping remote tests");
      return;
    }

    // 檢查是否是 localhost（跳過，因為這不是 remote DB 測試）
    if (remoteDbUrl.includes("localhost") || remoteDbUrl.includes("127.0.0.1")) {
      console.warn("⚠️ DATABASE_URL points to localhost, skipping remote tests");
      remoteDbUrl = undefined;
      return;
    }

    console.log("🔌 Connecting to remote database (READ-ONLY mode)...");
    prisma = createReadOnlyPrismaClient(remoteDbUrl);
    await prisma.$connect();
    console.log("✅ Connected to remote database");
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // 連接測試
  // ---------------------------------------------------------------------------

  it("should connect to remote database", async () => {
    if (!remoteDbUrl) {
      console.log("⏭️ Skipped: No remote database configured");
      return;
    }

    const result = await prisma.$queryRaw<Array<{ test: number }>>`SELECT 1 as test`;
    expect(result[0].test).toBe(1);
  });

  it("should verify pgvector extension is enabled", async () => {
    if (!remoteDbUrl) return;

    const result = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    expect(result.length).toBe(1);
    expect(result[0].extname).toBe("vector");
  });

  // ---------------------------------------------------------------------------
  // Schema 驗證測試
  // ---------------------------------------------------------------------------

  it("should read users count", async () => {
    if (!remoteDbUrl) return;

    const count = await prisma.user.count();
    expect(typeof count).toBe("number");
    console.log(`   📊 Users count: ${count}`);
  });

  it("should read areas count", async () => {
    if (!remoteDbUrl) return;

    const count = await prisma.area.count();
    expect(typeof count).toBe("number");
    console.log(`   📊 Areas count: ${count}`);
  });

  it("should read products count", async () => {
    if (!remoteDbUrl) return;

    const count = await prisma.product.count();
    expect(typeof count).toBe("number");
    console.log(`   📊 Products count: ${count}`);
  });

  it("should read tasks count", async () => {
    if (!remoteDbUrl) return;

    const count = await prisma.task.count();
    expect(typeof count).toBe("number");
    console.log(`   📊 Tasks count: ${count}`);
  });

  it("should read milestones count", async () => {
    if (!remoteDbUrl) return;

    const count = await prisma.milestone.count();
    expect(typeof count).toBe("number");
    console.log(`   📊 Milestones count: ${count}`);
  });

  // ---------------------------------------------------------------------------
  // 查詢性能測試
  // ---------------------------------------------------------------------------

  it("should measure simple query latency", async () => {
    if (!remoteDbUrl) return;

    const iterations = 5;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      latencies.push(Date.now() - start);
    }

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);

    console.log(`   ⏱️ Query latency: avg=${avg.toFixed(0)}ms, min=${min}ms, max=${max}ms`);
    expect(avg).toBeLessThan(1000); // 應該小於 1 秒
  });

  it("should measure complex query latency", async () => {
    if (!remoteDbUrl) return;

    const start = Date.now();
    await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM areas) as areas,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM tasks) as tasks
    `;
    const latency = Date.now() - start;

    console.log(`   ⏱️ Complex query latency: ${latency}ms`);
    expect(latency).toBeLessThan(2000); // 應該小於 2 秒
  });

  // ---------------------------------------------------------------------------
  // 安全測試 - 確保寫入被阻擋
  // ---------------------------------------------------------------------------

  it("should BLOCK create operations", async () => {
    if (!remoteDbUrl) return;

    expect(() =>
      prisma.user.create({
        data: {
          id: "test-blocked-id",
          email: "blocked@test.com",
          firebaseUid: "blocked-uid",
        },
      })
    ).toThrow("WRITE OPERATION BLOCKED");
  });

  it("should BLOCK update operations", async () => {
    if (!remoteDbUrl) return;

    expect(() =>
      prisma.user.update({
        where: { id: "any-id" },
        data: { email: "blocked@test.com" },
      })
    ).toThrow("WRITE OPERATION BLOCKED");
  });

  it("should BLOCK delete operations", async () => {
    if (!remoteDbUrl) return;

    expect(() =>
      prisma.user.delete({
        where: { id: "any-id" },
      })
    ).toThrow("WRITE OPERATION BLOCKED");
  });

  it("should BLOCK deleteMany operations", async () => {
    if (!remoteDbUrl) return;

    expect(() => prisma.user.deleteMany()).toThrow("WRITE OPERATION BLOCKED");
  });

  it("should BLOCK $executeRaw operations", async () => {
    if (!remoteDbUrl) return;

    expect(() => prisma.$executeRaw`DELETE FROM users WHERE 1=0`).toThrow(
      "RAW EXECUTE BLOCKED"
    );
  });

  // ---------------------------------------------------------------------------
  // API Use Case 模擬測試 - 驗證優化後的查詢正常運作
  // ---------------------------------------------------------------------------

  it("should execute GetLibraryUseCase query (areas → products → tasks JOIN)", async () => {
    if (!remoteDbUrl) return;

    const start = Date.now();

    // 模擬 GetLibraryUseCase 的 raw SQL JOIN 查詢
    const result = await prisma.$queryRaw<Array<{
      area_id: string;
      area_name: string;
      product_id: string | null;
      product_name: string | null;
      task_id: string | null;
      task_content: string | null;
    }>>`
      SELECT
        a.id::text as area_id,
        a.name as area_name,
        p.id::text as product_id,
        p.name as product_name,
        t.id::text as task_id,
        t.content as task_content
      FROM areas a
      LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
      LEFT JOIN tasks t ON t.product_id = p.id AND t.deleted_at IS NULL AND t.status != 'ARCHIVE'
      WHERE a.deleted_at IS NULL
      ORDER BY a.name, p.display_order, p.name, t.created_at DESC
      LIMIT 100
    `;

    const latency = Date.now() - start;
    console.log(`   📚 GetLibrary query: ${result.length} rows in ${latency}ms`);
    expect(Array.isArray(result)).toBe(true);
    expect(latency).toBeLessThan(3000); // 應該小於 3 秒
  });

  it("should execute GetMilestonesUseCase query (milestones JOIN entities)", async () => {
    if (!remoteDbUrl) return;

    const start = Date.now();

    // 模擬 GetMilestonesUseCase 的 raw SQL JOIN 查詢
    const result = await prisma.$queryRaw<Array<{
      milestone_id: string;
      milestone_name: string;
      entity_type: string;
      product_name: string | null;
      area_name: string | null;
    }>>`
      SELECT
        m.id::text as milestone_id,
        m.name as milestone_name,
        m.entity_type::text as entity_type,
        p.name as product_name,
        a.name as area_name
      FROM milestones m
      LEFT JOIN products p ON m.entity_type = 'PRODUCT' AND m.entity_id::uuid = p.id
      LEFT JOIN areas a ON m.entity_type = 'AREA' AND m.entity_id::uuid = a.id
      WHERE m.deleted_at IS NULL
      ORDER BY m.target_date ASC
      LIMIT 100
    `;

    const latency = Date.now() - start;
    console.log(`   🎯 GetMilestones query: ${result.length} rows in ${latency}ms`);
    expect(Array.isArray(result)).toBe(true);
    expect(latency).toBeLessThan(2000); // 應該小於 2 秒
  });

  it("should execute GetTasksUseCase completed_today query", async () => {
    if (!remoteDbUrl) return;

    const start = Date.now();

    // 計算今日範圍
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // 模擬 GetTasksUseCase 的 completed_today 查詢
    const result = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      status: string;
      product_name: string | null;
      area_name: string | null;
    }>>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        p.name as product_name,
        a.name as area_name
      FROM tasks t
      LEFT JOIN products p ON p.id = t.product_id
      LEFT JOIN areas a ON a.id = p.area_id
      WHERE t.deleted_at IS NULL
        AND t.status = 'ARCHIVE'::"statusenum"
        AND t.updated_at >= ${todayStart}
        AND t.updated_at < ${todayEnd}
      ORDER BY t.updated_at DESC
      LIMIT 100
    `;

    const latency = Date.now() - start;
    console.log(`   ✅ GetTasks completed_today query: ${result.length} rows in ${latency}ms`);
    expect(Array.isArray(result)).toBe(true);
    expect(latency).toBeLessThan(3000); // 應該小於 3 秒
  });

  it("should execute GetTasksUseCase with status filter", async () => {
    if (!remoteDbUrl) return;

    const start = Date.now();

    // 模擬 GetTasksUseCase 的 status 篩選查詢
    const result = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      status: string;
      product_name: string | null;
    }>>`
      SELECT
        t.id::text,
        t.content,
        t.status::text,
        p.name as product_name
      FROM tasks t
      LEFT JOIN products p ON p.id = t.product_id
      WHERE t.deleted_at IS NULL
        AND t.status = 'ACTIVE'::"statusenum"
      ORDER BY t.updated_at DESC
      LIMIT 100
    `;

    const latency = Date.now() - start;
    console.log(`   🔥 GetTasks ACTIVE query: ${result.length} rows in ${latency}ms`);
    expect(Array.isArray(result)).toBe(true);
    expect(latency).toBeLessThan(2000); // 應該小於 2 秒
  });

  // ---------------------------------------------------------------------------
  // Vector Search 測試（只讀）
  // ---------------------------------------------------------------------------

  it("should perform vector similarity search", async () => {
    if (!remoteDbUrl) return;

    // 創建一個測試向量（768 維，與 Gemini embedding 維度一致）
    const testVector = Array(768).fill(0.1);
    const vectorStr = `[${testVector.join(",")}]`;

    const result = await prisma.$queryRaw<
      Array<{ id: string; name: string; similarity: number }>
    >`
      SELECT
        id::text,
        name,
        1 - (embedding <=> ${vectorStr}::vector) as similarity
      FROM products
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 5
    `;

    console.log(`   🔍 Vector search returned ${result.length} results`);
    expect(Array.isArray(result)).toBe(true);
  });
});
