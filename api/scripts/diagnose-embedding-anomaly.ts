import { PrismaClient } from '@prisma/client';
import { getEmbedding, cosineSimilarity } from '../src/lib/embedding';

const prisma = new PrismaClient();
const USER_ID = '467c7125-d890-429f-b46f-168429b1907e';

async function diagnoseEmbeddingAnomaly() {
  try {
    console.log('🔬 診斷 Embedding 異常問題...\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 載入所有 Products
    const products = await prisma.product.findMany({
      where: { user_id: USER_ID, deleted_at: null },
      select: {
        name: true,
        description: true,
        tasks: {
          where: { deleted_at: null, status: { not: 'ARCHIVE' } },
          select: { content: true },
          take: 3
        }
      }
    });

    // 構建每個 Product 的文本
    const productTexts = products.map(p => {
      const parts = [p.name];
      if (p.description) {
        parts.push(p.description);
      }
      if (p.tasks.length > 0) {
        parts.push("最近任務: " + p.tasks.map(t => t.content).join(", "));
      }
      return {
        name: p.name,
        text: parts.join(" | "),
        hasDescription: !!p.description,
        descriptionLength: p.description?.length || 0,
        taskCount: p.tasks.length,
        textLength: parts.join(" | ").length
      };
    });

    console.log('📊 Products 基本資訊:\n');
    productTexts.forEach(p => {
      console.log(`📦 ${p.name}`);
      console.log(`   文本長度: ${p.textLength} 字元`);
      console.log(`   描述長度: ${p.descriptionLength} 字元`);
      console.log(`   任務數量: ${p.taskCount} 個`);
      console.log(`   完整文本: "${p.text.substring(0, 100)}${p.text.length > 100 ? '...' : ''}"`);
      console.log('');
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🧮 計算 Embedding 向量...\n');

    // 計算每個 Product 的 embedding
    const embeddings = await Promise.all(
      productTexts.map(async p => ({
        name: p.name,
        embedding: await getEmbedding(p.text),
        textLength: p.textLength,
        taskCount: p.taskCount
      }))
    );

    // 計算向量統計資訊
    console.log('📐 向量統計資訊:\n');
    embeddings.forEach(e => {
      const norm = Math.sqrt(e.embedding.reduce((sum, val) => sum + val * val, 0));
      const mean = e.embedding.reduce((sum, val) => sum + val, 0) / e.embedding.length;
      const max = Math.max(...e.embedding);
      const min = Math.min(...e.embedding);

      console.log(`📦 ${e.name}`);
      console.log(`   向量維度: ${e.embedding.length}`);
      console.log(`   向量範數 (norm): ${norm.toFixed(6)}`);
      console.log(`   平均值: ${mean.toFixed(6)}`);
      console.log(`   最大值: ${max.toFixed(6)}`);
      console.log(`   最小值: ${min.toFixed(6)}`);
      console.log(`   文本長度: ${e.textLength}, 任務數: ${e.taskCount}`);
      console.log('');
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🎯 測試「日文學習」與不同查詢的相似度:\n');

    const testQueries = [
      '優化資料庫查詢效能',
      '買菜煮飯',
      '辦理日本的區役所登記',
      '準備明天的跑步訓練計畫'
    ];

    const japaneseProduct = embeddings.find(e => e.name === '日文學習');

    if (japaneseProduct) {
      for (const query of testQueries) {
        const queryEmbedding = await getEmbedding(query);
        const similarity = cosineSimilarity(japaneseProduct.embedding, queryEmbedding);
        console.log(`   "${query}"`);
        console.log(`   → 相似度: ${(similarity * 100).toFixed(1)}%\n`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🔍 檢查是否有向量異常:\n');

    // 檢查是否有 norm 過小的向量
    const anomalies = embeddings.filter(e => {
      const norm = Math.sqrt(e.embedding.reduce((sum, val) => sum + val * val, 0));
      return norm < 0.9 || norm > 1.1; // 標準化後的向量 norm 應該接近 1
    });

    if (anomalies.length > 0) {
      console.log('⚠️  發現異常向量:\n');
      anomalies.forEach(a => {
        const norm = Math.sqrt(a.embedding.reduce((sum, val) => sum + val * val, 0));
        console.log(`   ⚠️  ${a.name}: norm = ${norm.toFixed(6)}`);
      });
    } else {
      console.log('✅ 所有向量的 norm 都在正常範圍內');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ 診斷失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseEmbeddingAnomaly();
