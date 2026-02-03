import { PrismaClient } from '@prisma/client';
import { findRelevantProducts } from '../src/lib/embedding';

const prisma = new PrismaClient();

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e'; // 吳柏宗

interface TestScenario {
  name: string;
  userInput: string;
  expectedProductNames?: string[];
  description?: string;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: '明確匹配單一專案',
    userInput: '修復 Zentropy 的登入 Bug',
    expectedProductNames: ['Zentropy'],
    description: '應該直接匹配到 Zentropy 專案'
  },
  {
    name: '跨專案技術關鍵字',
    userInput: '明天要優化資料庫查詢效能',
    description: '技術性關鍵字，可能匹配多個專案'
  },
  {
    name: '明確的日本相關任務',
    userInput: '準備日本代購的1對1會議資料',
    expectedProductNames: ['日本代購'],
    description: '應該匹配到日本代購專案'
  },
  {
    name: '個人生活事務',
    userInput: '買菜煮飯',
    expectedProductNames: ['個人事務'],
    description: '日常生活事務，應該匹配到個人事務'
  },
  {
    name: '日本搬家相關',
    userInput: '辦理日本的區役所登記',
    expectedProductNames: ['搬家去日本'],
    description: '應該匹配到搬家去日本專案'
  },
  {
    name: '運動訓練相關',
    userInput: '準備明天的跑步訓練計畫',
    expectedProductNames: ['Paceriz'],
    description: '跑步訓練相關，應該匹配到 Paceriz'
  }
];

async function testSemanticMatching() {
  try {
    console.log('🔍 語意匹配測試開始...\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 載入用戶的所有 Products（包含 tasks 和 sub_items）
    const allProducts = await prisma.product.findMany({
      where: { user_id: USER_ID, deleted_at: null },
      select: {
        id: true,
        name: true,
        description: true,
        tasks: {
          where: {
            deleted_at: null,
            status: { not: 'ARCHIVE' }
          },
          select: {
            content: true,
            sub_items: true  // 載入 sub_items
          },
          orderBy: { updated_at: 'desc' }
        }
      }
    });

    console.log(`✅ 載入了 ${allProducts.length} 個 Products\n`);
    console.log('可用的 Products:');
    allProducts.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.name}`);
    });
    console.log('\n═══════════════════════════════════════════════════════════════\n');

    // 執行每個測試場景
    for (const scenario of TEST_SCENARIOS) {
      console.log(`\n📝 測試場景: ${scenario.name}`);
      console.log(`   輸入: "${scenario.userInput}"`);
      if (scenario.description) {
        console.log(`   說明: ${scenario.description}`);
      }

      const startTime = Date.now();

      // 執行語意匹配（Top 4）
      const results = await findRelevantProducts(
        scenario.userInput,
        allProducts.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          tasks: p.tasks.map(t => ({
            content: t.content,
            // 解析 sub_items JSON，提取每個 subitem 的 content
            subItems: Array.isArray(t.sub_items)
              ? (t.sub_items as Array<{ content?: string }>).map(si => si.content).filter(Boolean) as string[]
              : []
          }))
        })),
        4  // Top 4 最相關的 Products
      );

      const elapsedTime = Date.now() - startTime;

      console.log(`\n   🎯 Top 4 匹配結果 (耗時: ${elapsedTime}ms):`);
      const emojis = ['🥇', '🥈', '🥉', '4️⃣'];
      results.forEach((result, idx) => {
        const similarity = (result.similarity * 100).toFixed(1);
        console.log(`      ${emojis[idx]} ${result.productName} - 相似度: ${similarity}%`);
      });

      // 檢查是否符合預期
      if (scenario.expectedProductNames && scenario.expectedProductNames.length > 0) {
        const topProductNames = results.map(r => r.productName);
        const hasMatch = scenario.expectedProductNames.some(expectedName =>
          topProductNames.includes(expectedName)
        );

        if (hasMatch) {
          console.log(`\n   ✅ 通過：預期的專案在 Top 4 中`);
        } else {
          console.log(`\n   ⚠️  注意：預期的專案 [${scenario.expectedProductNames.join(', ')}] 不在 Top 4 中`);
        }
      } else {
        console.log(`\n   ℹ️  此場景無特定預期，僅觀察結果`);
      }

      console.log('\n───────────────────────────────────────────────────────────────');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ 語意匹配測試完成！');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSemanticMatching();
