import * as fs from 'fs';
import * as path from 'path';

// 載入 API Key
const envLocalPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY'));
const API_KEY = apiKeyLine?.split('=')[1]?.trim();

async function getEmbedding(text: string, model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

async function testGeminiEmbedding001() {
  console.log('🧪 測試 gemini-embedding-001 模型...\n');

  const testTexts = [
    '買菜煮飯',
    '優化資料庫查詢效能',
    '準備明天的跑步訓練計畫',
    '修復 Zentropy 的登入 Bug'
  ];

  console.log('📊 測試繁體中文 embedding:\n');

  const embeddings = [];
  for (const text of testTexts) {
    try {
      const emb = await getEmbedding(text, 'gemini-embedding-001');
      embeddings.push({ text, emb });
      console.log(`✅ "${text}"`);
      console.log(`   維度: ${emb.length}`);
      console.log(`   前 10 個值: [${emb.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]`);
    } catch (error) {
      console.log(`❌ "${text}"`);
      console.log(`   錯誤: ${error}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('🔍 檢查是否所有向量都不同:\n');

  const groups: { [key: string]: string[] } = {};
  for (const { text, emb } of embeddings) {
    const key = emb.slice(0, 20).map((v: number) => v.toFixed(6)).join(',');
    if (!groups[key]) groups[key] = [];
    groups[key].push(text);
  }

  let hasDuplicates = false;
  for (const texts of Object.values(groups)) {
    if (texts.length > 1) {
      hasDuplicates = true;
      console.log('⚠️  以下文本產生了相同的 embedding:');
      texts.forEach(t => console.log(`   - "${t}"`));
    }
  }

  if (!hasDuplicates) {
    console.log('✅ 所有文本都產生了不同的 embedding！');

    // 計算相似度
    console.log('\n📊 向量相似度:');
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let k = 0; k < embeddings[i].emb.length; k++) {
          dotProduct += embeddings[i].emb[k] * embeddings[j].emb[k];
          normA += embeddings[i].emb[k] * embeddings[i].emb[k];
          normB += embeddings[j].emb[k] * embeddings[j].emb[k];
        }
        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        console.log(`   "${embeddings[i].text}" vs "${embeddings[j].text}": ${(similarity * 100).toFixed(1)}%`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

testGeminiEmbedding001().catch(console.error);
