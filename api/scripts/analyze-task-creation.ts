import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 查詢所有在 10:45 創建的任務
  const tasks = await prisma.task.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:45:00.000Z'),
        lte: new Date('2026-02-03T01:46:00.000Z'),
      },
      deleted_at: null,
    },
    include: {
      product: {
        include: { area: true }
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n找到 ${tasks.length} 個任務在 10:45 創建\n`);

  // 分析這些任務的特徵
  const withAiAnalysis = tasks.filter(t => t.ai_analysis !== null);
  const withoutAiAnalysis = tasks.filter(t => t.ai_analysis === null);

  console.log(`有 ai_analysis: ${withAiAnalysis.length} 個`);
  console.log(`無 ai_analysis: ${withoutAiAnalysis.length} 個`);

  // 按 Product 分組
  const byProduct = tasks.reduce((acc, task) => {
    const productName = task.product.name;
    if (!acc[productName]) acc[productName] = [];
    acc[productName].push(task.content);
    return acc;
  }, {} as Record<string, string[]>);

  console.log('\n按 Product 分組:');
  for (const [product, taskContents] of Object.entries(byProduct)) {
    console.log(`\n${product} (${taskContents.length} 個):`);
    taskContents.forEach(content => console.log(`  - ${content}`));
  }

  // 檢查是否有重複標題
  const titleCounts = tasks.reduce((acc, task) => {
    acc[task.content] = (acc[task.content] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duplicates = Object.entries(titleCounts).filter(([, count]) => count > 1);

  if (duplicates.length > 0) {
    console.log('\n\n⚠️ 發現重複標題:');
    for (const [title, count] of duplicates) {
      console.log(`  "${title}" 出現 ${count} 次`);

      const dupTasks = tasks.filter(t => t.content === title);
      for (const task of dupTasks) {
        console.log(`    - ID: ${task.id}`);
        console.log(`      創建: ${task.created_at}`);
        console.log(`      Product: ${task.product.name}`);
        console.log(`      Sub-items: ${JSON.stringify(task.sub_items)}`);
      }
    }
  }

  // 檢查是否有對應的 brain dump 日誌
  const logs = await prisma.systemEvaluationLog.findMany({
    where: {
      type: 'BRAIN_DUMP',
      created_at: {
        gte: new Date('2026-02-03T01:40:00.000Z'),
        lte: new Date('2026-02-03T01:50:00.000Z'),
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n\n找到 ${logs.length} 筆 brain dump 日誌 (10:40-10:50)`);

  if (logs.length === 0) {
    console.log('\n❌ 沒有任何 brain dump 日誌！');
    console.log('這表示這些任務不是通過 brain dump API 創建的。');
    console.log('\n可能的原因:');
    console.log('1. 透過其他 API 創建 (POST /api/tasks)');
    console.log('2. 資料庫直接操作');
    console.log('3. 同步功能');
    console.log('4. 測試腳本');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
