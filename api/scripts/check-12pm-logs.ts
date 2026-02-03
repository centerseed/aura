import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 12:13 JST = 03:13 UTC
  const logs = await prisma.systemEvaluationLog.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T03:00:00.000Z'),  // 12:00 JST
        lte: new Date('2026-02-03T04:00:00.000Z'),  // 13:00 JST
      }
    },
    orderBy: { created_at: 'desc' }
  });

  console.log(`\n找到 ${logs.length} 筆日誌 (12:00-13:00 JST):\n`);

  for (const log of logs) {
    const jstTime = new Date(log.created_at).toLocaleString('zh-TW', {
      timeZone: 'Asia/Tokyo',
      hour12: false
    });

    console.log(`=== 日誌 ===`);
    console.log(`時間 (JST): ${jstTime}`);
    console.log(`類型: ${log.type}`);
    console.log(`輸入:`, JSON.stringify(log.input_content, null, 2));
    console.log(`輸出:`, JSON.stringify(log.output_content, null, 2));
    console.log('\n');
  }

  // 查詢 "修復所有flutter問題" 相關的任務
  const flutterTasks = await prisma.task.findMany({
    where: {
      content: { contains: 'flutter' },
      deleted_at: null,
    },
    include: {
      product: { include: { area: true } }
    },
    orderBy: { created_at: 'desc' },
    take: 5
  });

  console.log('\n\n=== Flutter 相關任務 ===\n');
  for (const task of flutterTasks) {
    console.log(`任務: ${task.content}`);
    console.log(`  ID: ${task.id}`);
    console.log(`  Product: ${task.product.name}`);
    console.log(`  Area: ${task.product.area.name}`);
    console.log(`  創建時間: ${task.created_at}`);
    console.log(`  Sub-items: ${JSON.stringify(task.sub_items, null, 2)}`);
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
