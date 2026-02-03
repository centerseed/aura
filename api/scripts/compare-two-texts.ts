import * as fs from 'fs';
import * as path from 'path';

// 載入 API Key
const envLocalPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY'));
const API_KEY = apiKeyLine?.split('=')[1]?.trim();

async function getEmbedding(text: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] }
    })
  });

  const data = await response.json();
  return data.embedding.values;
}

async function compareTwoTexts() {
  const text1 = 'This is about machine learning and artificial intelligence';
  const text2 = 'I love eating pizza and pasta for dinner';

  console.log('🧪 測試兩個完全不同的文本（英文）:\n');
  console.log(`文本1: "${text1}"`);
  console.log(`文本2: "${text2}"\n`);

  console.log('獲取 embedding...\n');

  const emb1 = await getEmbedding(text1);
  const emb2 = await getEmbedding(text2);

  console.log(`文本1 前 10 個值: [${emb1.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]`);
  console.log(`文本2 前 10 個值: [${emb2.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]\n`);

  const allSame = emb1.every((val: number, idx: number) => Math.abs(val - emb2[idx]) < 0.0001);
  console.log(allSame ? '❌ 兩個向量完全相同！' : '✅ 兩個向量不同');

  if (!allSame) {
    // 計算相似度
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < emb1.length; i++) {
      dotProduct += emb1[i] * emb2[i];
      normA += emb1[i] * emb1[i];
      normB += emb2[i] * emb2[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    console.log(`相似度: ${(similarity * 100).toFixed(1)}%\n`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('🧪 測試繁體中文文本:\n');

  const zhText1 = '買菜煮飯';
  const zhText2 = '優化資料庫查詢效能';

  console.log(`文本1: "${zhText1}"`);
  console.log(`文本2: "${zhText2}"\n`);

  const zhEmb1 = await getEmbedding(zhText1);
  const zhEmb2 = await getEmbedding(zhText2);

  console.log(`文本1 前 10 個值: [${zhEmb1.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]`);
  console.log(`文本2 前 10 個值: [${zhEmb2.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]\n`);

  const zhAllSame = zhEmb1.every((val: number, idx: number) => Math.abs(val - zhEmb2[idx]) < 0.0001);
  console.log(zhAllSame ? '❌ 兩個向量完全相同！' : '✅ 兩個向量不同');

  if (!zhAllSame) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < zhEmb1.length; i++) {
      dotProduct += zhEmb1[i] * zhEmb2[i];
      normA += zhEmb1[i] * zhEmb1[i];
      normB += zhEmb2[i] * zhEmb2[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    console.log(`相似度: ${(similarity * 100).toFixed(1)}%\n`);
  }
}

compareTwoTexts().catch(console.error);
