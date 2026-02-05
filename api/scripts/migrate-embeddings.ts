/**
 * Embedding 遷移腳本
 *
 * 將 Products 的 embedding 從 Gemini API (3072 維) 遷移到
 * 本地 @xenova/transformers 模型 (384 維)
 *
 * 步驟：
 * 1. 清空舊的 embedding（維度不相容）
 * 2. 修改欄位類型為 vector(384)
 * 3. 刪除舊索引
 * 4. 重新計算所有 Products 的 embedding
 * 5. 建立 HNSW 索引（高效能向量搜尋）
 *
 * 執行方式：
 *   npx tsx scripts/migrate-embeddings.ts
 */

import { PrismaClient } from "@prisma/client";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const prisma = new PrismaClient();

// 本地模型配置
const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const EMBEDDING_DIM = 384;

let model: FeatureExtractionPipeline | null = null;

async function loadModel(): Promise<FeatureExtractionPipeline> {
  if (model) return model;

  console.log(`🔄 Loading model: ${MODEL_NAME}...`);
  const startTime = Date.now();

  model = await pipeline("feature-extraction", MODEL_NAME);

  console.log(`✅ Model loaded in ${Date.now() - startTime}ms`);
  return model;
}

async function getEmbedding(text: string): Promise<number[]> {
  const m = await loadModel();
  const output = await m(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function migrate() {
  console.log("🚀 Starting embedding migration...\n");

  try {
    // ========================================================================
    // Step 1: 清空舊的 embedding
    // ========================================================================
    console.log("📦 Step 1: Clearing old embeddings...");

    await prisma.$executeRaw`UPDATE products SET embedding = NULL WHERE embedding IS NOT NULL`;
    await prisma.$executeRaw`UPDATE tasks SET embedding = NULL WHERE embedding IS NOT NULL`;
    await prisma.$executeRaw`UPDATE topics SET semantic_center = NULL WHERE semantic_center IS NOT NULL`;

    console.log("✅ Old embeddings cleared\n");

    // ========================================================================
    // Step 2: 修改欄位類型為 vector(384)
    // ========================================================================
    console.log(`📐 Step 2: Altering column types to vector(${EMBEDDING_DIM})...`);

    // PostgreSQL 允許直接修改 vector 維度
    await prisma.$executeRaw`ALTER TABLE "products" ALTER COLUMN "embedding" TYPE vector(384)`;
    await prisma.$executeRaw`ALTER TABLE "tasks" ALTER COLUMN "embedding" TYPE vector(384)`;
    await prisma.$executeRaw`ALTER TABLE "topics" ALTER COLUMN "semantic_center" TYPE vector(384)`;

    console.log("✅ Column types updated\n");

    // ========================================================================
    // Step 3: 刪除舊索引
    // ========================================================================
    console.log("🗑️  Step 3: Dropping old indexes...");

    await prisma.$executeRaw`DROP INDEX IF EXISTS "products_embedding_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "tasks_embedding_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "topics_semantic_center_idx"`;

    console.log("✅ Old indexes dropped\n");

    // ========================================================================
    // Step 4: 重新計算所有 Products 的 embedding
    // ========================================================================
    console.log("🧮 Step 4: Computing new embeddings for Products...\n");

    // 載入並預熱模型
    const m = await loadModel();
    await m("warmup", { pooling: "mean", normalize: true });

    // 取得所有 Products
    const products = await prisma.product.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, description: true },
    });

    console.log(`   Found ${products.length} products to process\n`);

    let processed = 0;
    const batchSize = 10;

    for (const product of products) {
      const text = product.description
        ? `${product.name} | ${product.description}`
        : product.name;

      const startTime = Date.now();
      const embedding = await getEmbedding(text);
      const vectorStr = `[${embedding.join(",")}]`;

      await prisma.$executeRaw`
        UPDATE products
        SET embedding = ${vectorStr}::vector
        WHERE id = ${product.id}::uuid
      `;

      processed++;
      const elapsed = Date.now() - startTime;

      if (processed % batchSize === 0 || processed === products.length) {
        console.log(`   [${processed}/${products.length}] ${product.name} (${elapsed}ms)`);
      }
    }

    console.log(`\n✅ Computed ${processed} embeddings\n`);

    // ========================================================================
    // Step 5: 建立 HNSW 索引
    // ========================================================================
    console.log("📊 Step 5: Creating HNSW indexes for fast vector search...");

    // HNSW 索引比 IVF 更適合小型資料集（<100k），查詢更快
    // vector_cosine_ops 用於餘弦相似度
    await prisma.$executeRaw`
      CREATE INDEX "products_embedding_idx"
      ON "products"
      USING hnsw ("embedding" vector_cosine_ops)
    `;

    console.log("✅ HNSW index created on products.embedding\n");

    // ========================================================================
    // 驗證
    // ========================================================================
    console.log("🔍 Verifying migration...\n");

    const stats = await prisma.$queryRaw<
      Array<{ total: bigint; with_embedding: bigint }>
    >`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embedding
      FROM products
      WHERE deleted_at IS NULL
    `;

    const total = Number(stats[0].total);
    const withEmbedding = Number(stats[0].with_embedding);

    console.log(`   Products total: ${total}`);
    console.log(`   Products with embedding: ${withEmbedding}`);
    console.log(`   Coverage: ${total > 0 ? ((withEmbedding / total) * 100).toFixed(1) : 0}%\n`);

    // ========================================================================
    // 完成
    // ========================================================================
    console.log("🎉 Migration completed successfully!");
    console.log(`   - Embedding dimension: ${EMBEDDING_DIM}`);
    console.log(`   - Model: ${MODEL_NAME}`);
    console.log(`   - Index type: HNSW`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 執行遷移
migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
