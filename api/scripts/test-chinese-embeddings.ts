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

async function testChineseEmbeddings() {
  const testTexts = [
    '買菜煮飯',
    '優化資料庫查詢效能',
    '準備明天的跑步訓練計畫',
    '辦理日本的區役所登記',
    '修復 Zentropy 的登入 Bug',
    '貓咪很可愛',
    'Hello World',
    '你好世界',
    'database optimization',
    '資料庫最佳化'
  ];

  console.log('🧪 測試各種文本的 Embedding...\n');

  const embeddings = [];
  for (const text of testTexts) {
    const emb = await getEmbedding(text);
    embeddings.push({ text, emb });
    console.log(`✅ "${text}"`);
    console.log(`   前 10 個值: [${emb.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('🔍 檢查哪些文本產生了相同的 embedding:\n');

  const groups: { [key: string]: string[] } = {};

  for (let i = 0; i < embeddings.length; i++) {
    const key = embeddings[i].emb.slice(0, 20).map((v: number) => v.toFixed(6)).join(',');

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(embeddings[i].text);
  }

  let groupNum = 1;
  for (const [key, texts] of Object.entries(groups)) {
    if (texts.length > 1) {
      console.log(`⚠️  群組 ${groupNum}: 以下文本產生了相同的 embedding:`);
      texts.forEach(t => console.log(`   - "${t}"`));
      console.log('');
      groupNum++;
    }
  }

  if (groupNum === 1) {
    console.log('✅ 所有文本都產生了不同的 embedding');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

testChineseEmbeddings().catch(console.error);
