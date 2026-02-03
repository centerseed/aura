import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 10:50 JST = 01:50 UTC
  // 12:00 JST = 03:00 UTC
  const logs = await prisma.systemEvaluationLog.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:50:00.000Z'),
        lte: new Date('2026-02-03T03:00:00.000Z'),
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n找到 ${logs.length} 筆日誌 (10:50-12:00 JST):\n`);

  for (const log of logs) {
    const jstTime = new Date(log.created_at).toLocaleString('zh-TW', {
      timeZone: 'Asia/Tokyo',
      hour12: false
    });

    console.log(`===================`);
    console.log(`時間 (JST): ${jstTime}`);
    console.log(`類型: ${log.type}`);
    console.log(`輸入:`, JSON.stringify(log.input_content, null, 2));
    console.log(`輸出:`, JSON.stringify(log.output_content, null, 2));

    // 檢查是否有創建多個相同標題的任務
    if (log.type === 'BRAIN_DUMP') {
      const output = log.output_content as any;
      if (output.action === 'create_new_tasks' && output.items) {
        const titles = output.items.map((item: any) => item.title);
        console.log(`創建的任務標題:`, titles);

        // 檢查重複
        const titleCounts: Record<string, number> = {};
        titles.forEach((title: string) => {
          titleCounts[title] = (titleCounts[title] || 0) + 1;
        });

        const duplicates = Object.entries(titleCounts).filter(([, count]) => count > 1);
        if (duplicates.length > 0) {
          console.log(`\n⚠️⚠️⚠️ AI 在同一次輸出中產生重複標題:`);
          duplicates.forEach(([title, count]) => {
            console.log(`  "${title}" 出現 ${count} 次`);
          });
        }
      }
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
