import { google } from "@ai-sdk/google";
import { embed } from "ai";
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

async function testEmbeddingAPI() {
  console.log('🧪 測試 Google Embedding API...\n');

  const texts = [
    '優化資料庫查詢效能',
    '買菜煮飯',
    '辦理日本的區役所登記',
    '準備明天的跑步訓練計畫'
  ];

  console.log('方法 1: 逐一調用 embed()（順序）\n');

  const embeddings1 = [];
  for (const text of texts) {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("text-embedding-004"),
      value: text,
    });
    embeddings1.push(embedding);
    console.log(`✅ "${text}"`);
    console.log(`   前 10 個值: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]\n`);
  }

  console.log('\n檢查是否所有向量相同:');
  const allSame1 = embeddings1.every(emb =>
    emb.every((val, idx) => Math.abs(val - embeddings1[0][idx]) < 0.0001)
  );
  console.log(allSame1 ? '❌ 所有向量相同！' : '✅ 向量都不同');

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('方法 2: 並發調用 embed()（Promise.all）\n');

  const embeddings2 = await Promise.all(
    texts.map(async text => {
      const { embedding } = await embed({
        model: google.textEmbeddingModel("text-embedding-004"),
        value: text,
      });
      return { text, embedding };
    })
  );

  embeddings2.forEach(({ text, embedding }) => {
    console.log(`✅ "${text}"`);
    console.log(`   前 10 個值: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]\n`);
  });

  console.log('\n檢查是否所有向量相同:');
  const allSame2 = embeddings2.every(({ embedding }) =>
    embedding.every((val, idx) => Math.abs(val - embeddings2[0].embedding[idx]) < 0.0001)
  );
  console.log(allSame2 ? '❌ 所有向量相同！' : '✅ 向量都不同');

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

testEmbeddingAPI();
