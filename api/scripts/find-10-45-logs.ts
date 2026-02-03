import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 任務創建時間: 10:45:28 和 10:45:31 JST = 01:45:28 和 01:45:31 UTC
  // 查詢前後 5 分鐘的評估日誌
  const logs = await prisma.systemEvaluationLog.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:40:00.000Z'),
        lte: new Date('2026-02-03T01:50:00.000Z'),
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n找到 ${logs.length} 筆日誌 (10:40-10:50 JST):\n`);

  for (const log of logs) {
    const jstTime = new Date(log.created_at).toLocaleString('zh-TW', {
      timeZone: 'Asia/Tokyo',
      hour12: false
    });

    console.log(`=== 日誌 ${log.id} ===`);
    console.log(`時間 (JST): ${jstTime}`);
    console.log(`類型: ${log.type}`);
    console.log(`輸入:`, JSON.stringify(log.input_content, null, 2));
    console.log(`輸出:`, JSON.stringify(log.output_content, null, 2));
    console.log('');
  }

  // 也查詢這兩個任務附近創建的所有任務
  const tasks = await prisma.task.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:40:00.000Z'),
        lte: new Date('2026-02-03T01:50:00.000Z'),
      },
      deleted_at: null,
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n找到 ${tasks.length} 個任務 (10:40-10:50 JST):\n`);

  for (const task of tasks) {
    const jstTime = new Date(task.created_at).toLocaleString('zh-TW', {
      timeZone: 'Asia/Tokyo',
      hour12: false
    });

    console.log(`任務 ${task.id.substring(0, 8)}: ${task.content}`);
    console.log(`  時間: ${jstTime}`);
    console.log(`  AI Analysis: ${task.ai_analysis ? 'Yes' : 'No'}`);
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
