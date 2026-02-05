/**
 * Next.js Instrumentation
 *
 * 在 Next.js 伺服器啟動時執行，用於預熱：
 * - Neon 連線池（避免首次連線延遲）
 *
 * 注意：Embedding 改用 Gemini API，不需要本地模型預熱
 *
 * 參考：https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js runtime 執行（非 Edge）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const startTime = Date.now();
    console.log("🚀 [instrumentation] Warming up...");

    // Neon 連線池預熱（帶重試機制，因為 Neon 有冷啟動延遲）
    try {
      const { prisma } = await import("./lib/db");
      const maxRetries = 3;
      const retryDelay = 2000; // 2 秒

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await prisma.$queryRaw`SELECT 1`;
          console.log("✅ [instrumentation] database ready");
          break;
        } catch (error) {
          if (attempt === maxRetries) {
            console.error("❌ [instrumentation] database warmup failed:", error);
          } else {
            console.log(`⏳ [instrumentation] DB connection attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
    } catch (error) {
      console.error("❌ [instrumentation] warmup failed:", error);
    }

    console.log(`🏁 [instrumentation] Warmup completed in ${Date.now() - startTime}ms`);
  }
}
