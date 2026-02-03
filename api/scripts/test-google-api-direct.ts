import * as fs from 'fs';
import * as path from 'path';

// 載入 API Key
const envLocalPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY'));
const API_KEY = apiKeyLine?.split('=')[1]?.trim();

if (!API_KEY) {
  console.error('❌ 找不到 GOOGLE_GENERATIVE_AI_API_KEY');
  process.exit(1);
}

async function callGoogleEmbeddingAPI(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text }]
      }
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

async function testDirectAPI() {
  console.log('🧪 直接調用 Google Embedding API（繞過 AI SDK）...\n');

  const texts = [
    '優化資料庫查詢效能',
    '買菜煮飯',
    '辦理日本的區役所登記',
    '準備明天的跑步訓練計畫'
  ];

  console.log('順序調用 Google API:\n');

  const embeddings = [];
  for (const text of texts) {
    const embedding = await callGoogleEmbeddingAPI(text);
    embeddings.push(embedding);
    console.log(`✅ "${text}"`);
    console.log(`   維度: ${embedding.length}`);
    console.log(`   前 10 個值: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]\n`);

    // 避免 rate limit
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('檢查是否所有向量相同:\n');

  const allSame = embeddings.every(emb =>
    emb.every((val, idx) => Math.abs(val - embeddings[0][idx]) < 0.0001)
  );

  if (allSame) {
    console.log('❌ 所有向量相同 - 這是 Google API 的問題！');
  } else {
    console.log('✅ 向量都不同 - 問題出在 AI SDK！');

    // 顯示向量之間的差異
    console.log('\n向量相似度檢查:');
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        // 簡單的點積相似度
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let k = 0; k < embeddings[i].length; k++) {
          dotProduct += embeddings[i][k] * embeddings[j][k];
          normA += embeddings[i][k] * embeddings[i][k];
          normB += embeddings[j][k] * embeddings[j][k];
        }
        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        console.log(`   "${texts[i]}" vs "${texts[j]}": ${(similarity * 100).toFixed(1)}%`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

testDirectAPI().catch(console.error);
