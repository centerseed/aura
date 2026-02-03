import * as fs from 'fs';
import * as path from 'path';

// 載入環境變數
const envLocalPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

import { getEmbedding, cosineSimilarity } from '../src/lib/embedding';

async function debugWhyJapanFirst() {
  console.log('🔍 分析為什麼「日本代購」排第一...\n');

  const userQuery = '準備明天的跑步訓練計畫';

  // 分解查詢的關鍵詞
  const queryParts = ['準備', '明天', '跑步', '訓練', '計畫'];

  // 兩個 Product 的文本
  const japanText = '日本代購 | 提供日本代購一對一專業諮詢服務。 | 任務: 準備日本代購士1 on 1';
  const pacerizText = 'Paceriz | Paceriz 方法論與 v2 週課表轉換及 UI 測試優化。 | 任務: Paceriz v2週課表轉換測試, Paceriz v2 課表 UI 修正, Paceriz 方法論測試';

  console.log(`查詢: "${userQuery}"\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 計算完整查詢的相似度
  console.log('📊 完整查詢的相似度:\n');
  const queryEmb = await getEmbedding(userQuery);
  const japanEmb = await getEmbedding(japanText);
  const pacerizEmb = await getEmbedding(pacerizText);

  console.log(`   日本代購: ${(cosineSimilarity(queryEmb, japanEmb) * 100).toFixed(1)}%`);
  console.log(`   Paceriz: ${(cosineSimilarity(queryEmb, pacerizEmb) * 100).toFixed(1)}%`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('🔬 逐詞分析（哪個關鍵詞導致日本代購勝出）:\n');

  for (const keyword of queryParts) {
    const keywordEmb = await getEmbedding(keyword);
    const japanSim = cosineSimilarity(keywordEmb, japanEmb);
    const pacerizSim = cosineSimilarity(keywordEmb, pacerizEmb);

    const winner = japanSim > pacerizSim ? '日本代購 🏆' : 'Paceriz 🏆';
    const diff = Math.abs(japanSim - pacerizSim) * 100;

    console.log(`   「${keyword}」:`);
    console.log(`      日本代購: ${(japanSim * 100).toFixed(1)}%`);
    console.log(`      Paceriz: ${(pacerizSim * 100).toFixed(1)}%`);
    console.log(`      勝出: ${winner} (差距: ${diff.toFixed(1)}%)\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('🧪 如果 Paceriz 有「跑步訓練」關鍵字會怎樣?\n');

  const betterPacerizText = 'Paceriz | 跑步訓練 App，提供個人化訓練課表與方法論。 | 任務: 規劃跑步訓練計畫, 測試訓練方法論';
  const betterPacerizEmb = await getEmbedding(betterPacerizText);

  console.log(`   改善前 Paceriz: ${(cosineSimilarity(queryEmb, pacerizEmb) * 100).toFixed(1)}%`);
  console.log(`   改善後 Paceriz: ${(cosineSimilarity(queryEmb, betterPacerizEmb) * 100).toFixed(1)}%`);
  console.log(`   日本代購: ${(cosineSimilarity(queryEmb, japanEmb) * 100).toFixed(1)}%`);

  const newWinner = cosineSimilarity(queryEmb, betterPacerizEmb) > cosineSimilarity(queryEmb, japanEmb)
    ? '✅ Paceriz 會勝出！'
    : '❌ 日本代購仍然勝出';
  console.log(`\n   結果: ${newWinner}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

debugWhyJapanFirst();
