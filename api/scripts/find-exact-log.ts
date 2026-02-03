import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 查詢那兩個重複任務的創建時間附近的所有日誌
  const task1Time = new Date('2026-02-03T01:45:28.000Z'); // 10:45:28 JST
  const task2Time = new Date('2026-02-03T01:45:31.000Z'); // 10:45:31 JST

  console.log('任務 1 創建時間 (UTC):', task1Time);
  console.log('任務 2 創建時間 (UTC):', task2Time);

  // 查詢前後 10 分鐘的所有日誌
  const logs = await prisma.systemEvaluationLog.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:35:00.000Z'),
        lte: new Date('2026-02-03T01:55:00.000Z'),
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n找到 ${logs.length} 筆日誌:`);

  for (const log of logs) {
    console.log(`\n時間: ${log.created_at.toISOString()}`);
    console.log(`類型: ${log.type}`);
    console.log(`輸入:`, JSON.stringify(log.input_content));
    console.log(`輸出:`, JSON.stringify(log.output_content, null, 2));

    // 檢查輸出中是否有重複的標題
    if (log.type === 'BRAIN_DUMP') {
      const output = log.output_content as any;
      if (output.action === 'create_new_tasks' && output.items) {
        const titles = output.items.map((item: any) => item.title);
        const duplicates = titles.filter((title: string, index: number) =>
          titles.indexOf(title) !== index
        );
        if (duplicates.length > 0) {
          console.log('\n⚠️⚠️⚠️ AI 輸出包含重複標題:', duplicates);
        }
      }
    }
  }

  // 也檢查是否有批量創建任務的其他日誌類型
  const allLogs = await prisma.systemEvaluationLog.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:35:00.000Z'),
        lte: new Date('2026-02-03T01:55:00.000Z'),
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n\n所有類型的日誌:`);
  for (const log of allLogs) {
    console.log(`${log.created_at.toISOString()} - ${log.type}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
