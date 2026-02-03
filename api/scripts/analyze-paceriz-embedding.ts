import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();
const USER_ID = '467c7125-d890-429f-b46f-168429b1907e';

async function analyzePacerizEmbedding() {
  try {
    console.log('🔍 分析 Paceriz 語意匹配問題...\n');

    const userQuery = '準備明天的跑步訓練計畫';
    console.log(`查詢: "${userQuery}"\n`);

    // 載入相關 Products
    const products = await prisma.product.findMany({
      where: {
        user_id: USER_ID,
        deleted_at: null,
        name: { in: ['Paceriz', '日本代購', '個人事務'] }
      },
      select: {
        name: true,
        description: true,
        tasks: {
          where: { deleted_at: null, status: { not: 'ARCHIVE' } },
          select: { content: true }
        }
      }
    });

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 各 Product 的完整文本（用於計算 embedding）:\n');

    const productTexts: { name: string; text: string }[] = [];

    for (const p of products) {
      const parts = [p.name];
      if (p.description) parts.push(p.description);
      if (p.tasks.length > 0) {
        parts.push("任務: " + p.tasks.map(t => t.content).join(", "));
      }
      const text = parts.join(" | ");
      productTexts.push({ name: p.name, text });

      console.log(`📦 ${p.name}`);
      console.log(`   完整文本: "${text}"`);
      console.log(`   文本長度: ${text.length} 字元`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🧮 計算 embedding 並比較相似度:\n');

    const queryEmbedding = await getEmbedding(userQuery);

    for (const { name, text } of productTexts) {
      const productEmbedding = await getEmbedding(text);
      const similarity = cosineSimilarity(queryEmbedding, productEmbedding);
      console.log(`   ${name}: ${(similarity * 100).toFixed(1)}%`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log('🔬 問題分析:\n');

    // 檢查 Paceriz 的內容是否包含「跑步」或「訓練」
    const paceriz = products.find(p => p.name === 'Paceriz');
    if (paceriz) {
      const fullText = paceriz.description + ' ' + paceriz.tasks.map(t => t.content).join(' ');
      console.log('Paceriz 內容是否包含關鍵字:');
      console.log(`   "跑步": ${fullText.includes('跑步') ? '✅ 有' : '❌ 沒有'}`);
      console.log(`   "訓練": ${fullText.includes('訓練') ? '✅ 有' : '❌ 沒有'}`);
      console.log(`   "運動": ${fullText.includes('運動') ? '✅ 有' : '❌ 沒有'}`);
      console.log(`   "課表": ${fullText.includes('課表') ? '✅ 有' : '❌ 沒有'}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ 分析失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePacerizEmbedding();
