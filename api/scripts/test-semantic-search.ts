/**
 * 語意搜尋測試腳本
 *
 * 直接測試 embedding 語意搜尋找出相關 Products
 *
 * 執行：npx tsx scripts/test-semantic-search.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const prisma = new PrismaClient();

const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
let model: FeatureExtractionPipeline | null = null;

async function loadModel(): Promise<FeatureExtractionPipeline> {
  if (model) return model;
  console.log(`🔄 Loading model: ${MODEL_NAME}...`);
  const start = Date.now();
  model = await pipeline("feature-extraction", MODEL_NAME);
  console.log(`✅ Model loaded in ${Date.now() - start}ms\n`);
  return model;
}

async function getEmbedding(text: string): Promise<number[]> {
  const m = await loadModel();
  const output = await m(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function findRelevantProducts(
  userInput: string,
  userId: string,
  topK: number = 5
) {
  const startTime = Date.now();

  // 計算用戶輸入的 embedding
  const userEmbedding = await getEmbedding(userInput);
  const embeddingTime = Date.now() - startTime;

  const vectorStr = `[${userEmbedding.join(",")}]`;

  // pgvector 搜尋
  const searchStart = Date.now();
  const results = await prisma.$queryRaw<
    Array<{ id: string; name: string; description: string | null; similarity: number }>
  >`
    SELECT
      id::text,
      name,
      description,
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM products
    WHERE user_id = ${userId}::uuid
      AND deleted_at IS NULL
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `;
  const searchTime = Date.now() - searchStart;

  return {
    results,
    timings: {
      embedding: embeddingTime,
      search: searchTime,
      total: Date.now() - startTime,
    },
  };
}

async function test() {
  console.log("🧪 語意搜尋測試\n");
  console.log("═".repeat(60));

  // 取得一個有效的 userId
  const user = await prisma.user.findFirst({
    select: { id: true, email: true },
  });

  if (!user) {
    console.error("❌ 沒有找到任何用戶");
    return;
  }

  console.log(`👤 測試用戶: ${user.email}\n`);

  // 測試案例
  const testCases = [
    "修復登入頁面的 Bug",
    "準備客戶會議簡報",
    "日本公司設立",
    "減肥運動計劃",
    "整理財務報表",
    "寫程式碼",
  ];

  for (const input of testCases) {
    console.log(`📝 輸入: "${input}"`);

    const { results, timings } = await findRelevantProducts(input, user.id, 5);

    console.log(`⏱️  耗時: embedding ${timings.embedding}ms | 搜尋 ${timings.search}ms | 總計 ${timings.total}ms`);
    console.log(`📊 找到 ${results.length} 個相關 Products:`);

    for (const r of results) {
      const desc = r.description ? ` - ${r.description.substring(0, 30)}...` : "";
      console.log(`   ${(r.similarity * 100).toFixed(1)}% | ${r.name}${desc}`);
    }

    console.log("─".repeat(60));
  }

  console.log("\n✅ 測試完成");
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
