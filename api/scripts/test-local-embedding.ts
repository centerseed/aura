/**
 * 本地 Embedding 模型測試腳本
 *
 * 驗證 @xenova/transformers 模型是否正常運作
 *
 * 執行方式：
 *   npx tsx scripts/test-local-embedding.ts
 */

import { pipeline } from "@xenova/transformers";

async function test() {
  console.log("🧪 Testing local embedding model...\n");

  // 載入模型
  console.log("📦 Loading model...");
  const startLoad = Date.now();
  const model = await pipeline(
    "feature-extraction",
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
  );
  console.log(`✅ Model loaded in ${Date.now() - startLoad}ms\n`);

  // 測試文本（繁體中文 + 英文混合）
  const testTexts = [
    "修復登入頁面的 Bug",
    "準備下週的客戶會議簡報",
    "Fix authentication error",
    "更新產品定價策略",
    "Review pull request #123",
  ];

  console.log("📊 Testing embedding generation:\n");

  const embeddings: number[][] = [];

  for (const text of testTexts) {
    const start = Date.now();
    const output = await model(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    embeddings.push(embedding);

    const elapsed = Date.now() - start;
    console.log(`   "${text}"`);
    console.log(`   → ${embedding.length} 維, ${elapsed}ms\n`);
  }

  // 計算相似度（驗證語意理解）
  console.log("🔍 Testing semantic similarity:\n");

  function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 比較中英文相似任務
  const sim1 = cosineSimilarity(embeddings[0], embeddings[2]); // Bug fix 中英
  const sim2 = cosineSimilarity(embeddings[0], embeddings[1]); // Bug fix vs 會議
  const sim3 = cosineSimilarity(embeddings[1], embeddings[3]); // 會議 vs 定價（都是業務相關）

  console.log(`   "修復登入頁面的 Bug" vs "Fix authentication error": ${(sim1 * 100).toFixed(1)}%`);
  console.log(`   "修復登入頁面的 Bug" vs "準備下週的客戶會議簡報": ${(sim2 * 100).toFixed(1)}%`);
  console.log(`   "準備下週的客戶會議簡報" vs "更新產品定價策略": ${(sim3 * 100).toFixed(1)}%`);

  console.log("\n✅ Test completed!");

  // 驗證結果
  if (embeddings[0].length !== 384) {
    console.error(`❌ 維度錯誤: 預期 384，實際 ${embeddings[0].length}`);
    process.exit(1);
  }

  if (sim1 < 0.3) {
    console.error(`❌ 語意相似度過低: 中英文相似任務應該 > 30%`);
    process.exit(1);
  }

  console.log("\n🎉 All tests passed!");
}

test().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
