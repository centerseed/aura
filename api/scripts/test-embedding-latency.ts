/**
 * Embedding 延遲測試
 *
 * 執行：npx tsx scripts/test-embedding-latency.ts
 */

import "dotenv/config";
import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

const EMBEDDING_MODEL = "gemini-embedding-001";

async function testSingleEmbedding(text: string): Promise<number> {
  const start = Date.now();
  await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });
  return Date.now() - start;
}

async function testBatchEmbedding(texts: string[]): Promise<number> {
  const start = Date.now();
  await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });
  return Date.now() - start;
}

async function main() {
  console.log("🧪 Embedding 延遲測試\n");
  console.log(`模型: ${EMBEDDING_MODEL}`);
  console.log("─".repeat(50));

  // 測試用例
  const shortText = "修復登入頁面的 Bug";
  const mediumText = "我需要在週五之前完成客戶報告，包含上季度的銷售數據分析";
  const longText = "這是一個比較長的輸入，包含多個任務：1. 回覆客戶郵件 2. 檢查系統日誌 3. 更新專案進度 4. 準備週報 5. 安排下週會議";

  // 冷啟動測試
  console.log("\n📊 冷啟動測試（第一次調用）:");
  const coldStart = await testSingleEmbedding("warm up");
  console.log(`   冷啟動延遲: ${coldStart}ms`);

  // 單一 embedding 測試
  console.log("\n📊 單一 Embedding 測試（連續 5 次）:");

  const singleResults: number[] = [];
  for (let i = 0; i < 5; i++) {
    const latency = await testSingleEmbedding(shortText);
    singleResults.push(latency);
    console.log(`   第 ${i + 1} 次: ${latency}ms`);
  }
  const avgSingle = singleResults.reduce((a, b) => a + b, 0) / singleResults.length;
  console.log(`   平均延遲: ${avgSingle.toFixed(0)}ms`);

  // 不同長度測試
  console.log("\n📊 不同輸入長度測試:");
  const shortLatency = await testSingleEmbedding(shortText);
  console.log(`   短文本 (${shortText.length}字): ${shortLatency}ms`);

  const mediumLatency = await testSingleEmbedding(mediumText);
  console.log(`   中等文本 (${mediumText.length}字): ${mediumLatency}ms`);

  const longLatency = await testSingleEmbedding(longText);
  console.log(`   長文本 (${longText.length}字): ${longLatency}ms`);

  // 批次 embedding 測試
  console.log("\n📊 批次 Embedding 測試:");
  const batch5 = await testBatchEmbedding([shortText, mediumText, longText, shortText, mediumText]);
  console.log(`   5 個文本批次: ${batch5}ms (平均 ${(batch5/5).toFixed(0)}ms/個)`);

  const batch10Texts = Array(10).fill(shortText);
  const batch10 = await testBatchEmbedding(batch10Texts);
  console.log(`   10 個文本批次: ${batch10}ms (平均 ${(batch10/10).toFixed(0)}ms/個)`);

  // 總結
  console.log("\n" + "─".repeat(50));
  console.log("📋 總結:");
  console.log(`   - 單次 embedding 平均延遲: ~${avgSingle.toFixed(0)}ms`);
  console.log(`   - 這個延遲主要來自網路 RTT（台灣到 Google 伺服器）`);
  console.log(`   - 批次處理可以降低平均延遲`);

  if (avgSingle > 500) {
    console.log("\n⚠️  延遲較高！可能原因:");
    console.log("   1. 網路延遲（跨區域）");
    console.log("   2. API 冷啟動");
    console.log("   3. 模型本身較慢");
  }
}

main().catch(console.error);
