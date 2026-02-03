import { getEmbedding, cosineSimilarity } from '../src/lib/embedding';
import * as fs from 'fs';
import * as path from 'path';

// 手動載入 .env.local
const envLocalPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

async function diagnoseQueryEmbedding() {
  try {
    console.log('🔬 診斷查詢 Embedding 問題...\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const testQueries = [
      '優化資料庫查詢效能',
      '買菜煮飯',
      '辦理日本的區役所登記',
      '準備明天的跑步訓練計畫'
    ];

    console.log('📊 計算每個查詢的 Embedding...\n');

    const queryEmbeddings = await Promise.all(
      testQueries.map(async query => ({
        query,
        embedding: await getEmbedding(query)
      }))
    );

    // 顯示每個查詢的向量統計
    queryEmbeddings.forEach(q => {
      const norm = Math.sqrt(q.embedding.reduce((sum, val) => sum + val * val, 0));
      const mean = q.embedding.reduce((sum, val) => sum + val, 0) / q.embedding.length;

      console.log(`📝 "${q.query}"`);
      console.log(`   向量 norm: ${norm.toFixed(6)}`);
      console.log(`   平均值: ${mean.toFixed(6)}`);
      console.log(`   前 10 個值: [${q.embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]`);
      console.log('');
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🎯 檢查查詢之間的相似度:\n');

    // 計算查詢之間的相似度
    for (let i = 0; i < queryEmbeddings.length; i++) {
      for (let j = i + 1; j < queryEmbeddings.length; j++) {
        const similarity = cosineSimilarity(
          queryEmbeddings[i].embedding,
          queryEmbeddings[j].embedding
        );
        console.log(`"${queryEmbeddings[i].query}"`);
        console.log(`vs "${queryEmbeddings[j].query}"`);
        console.log(`→ 相似度: ${(similarity * 100).toFixed(1)}%\n`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🔍 檢查是否所有查詢產生相同的向量:\n');

    // 檢查是否所有向量都相同
    const firstEmbedding = queryEmbeddings[0].embedding;
    const allSame = queryEmbeddings.every(q =>
      q.embedding.every((val, idx) => Math.abs(val - firstEmbedding[idx]) < 0.0001)
    );

    if (allSame) {
      console.log('⚠️  所有查詢產生了相同的 embedding 向量！');
      console.log('   這表示 embedding API 或緩存有問題！');
    } else {
      console.log('✅ 每個查詢都產生了不同的 embedding 向量');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    // 測試「日文學習」的文本
    console.log('🧪 測試「日文學習」文本的 embedding:\n');

    const japaneseText = '日文學習 | 單字，文法，日常對話';
    const japaneseEmbedding = await getEmbedding(japaneseText);

    const japaneseNorm = Math.sqrt(japaneseEmbedding.reduce((sum, val) => sum + val * val, 0));
    console.log(`📦 "${japaneseText}"`);
    console.log(`   向量 norm: ${japaneseNorm.toFixed(6)}`);
    console.log(`   前 10 個值: [${japaneseEmbedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]`);
    console.log('');

    console.log('\n📊 「日文學習」與每個查詢的相似度:\n');
    for (const q of queryEmbeddings) {
      const similarity = cosineSimilarity(japaneseEmbedding, q.embedding);
      console.log(`   "${q.query}" → ${(similarity * 100).toFixed(1)}%`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ 診斷失敗:', error);
  }
}

diagnoseQueryEmbedding();
