import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 搜索包含 "修正" 或 "前後端" 或 "問題" 的所有日誌
  const logs = await prisma.systemEvaluationLog.findMany({
    where: {
      type: 'BRAIN_DUMP',
    },
    orderBy: { created_at: 'desc' },
    take: 50
  });

  console.log(`檢查最近 50 筆 brain dump 日誌...\n`);

  const matchedLogs = logs.filter(log => {
    const input = log.input_content as any;
    const text = input?.text || '';
    return text.includes('修正') || text.includes('前後端') || text.includes('問題') || text.includes('bug');
  });

  console.log(`找到 ${matchedLogs.length} 筆相關日誌:\n`);

  for (const log of matchedLogs) {
    const input = log.input_content as any;
    const output = log.output_content as any;

    console.log(`===================`);
    console.log(`時間: ${log.created_at.toISOString()}`);
    console.log(`輸入: ${JSON.stringify(input)}`);
    console.log(`動作: ${output.action}`);

    if (output.action === 'create_new_tasks') {
      console.log(`創建任務數量: ${output.items?.length || 0}`);
      if (output.items) {
        console.log(`任務標題:`);
        output.items.forEach((item: any, idx: number) => {
          console.log(`  ${idx + 1}. ${item.title}`);
        });
      }
    } else if (output.action === 'append_sub_item') {
      console.log(`追加到任務: ${output.target_task_id}`);
      console.log(`追加項目數: ${output.sub_items?.length || 0}`);
    }
    console.log('');
  }

  // 也檢查是否有在 10:45 前後的任何 brain dump
  const timeLogs = await prisma.systemEvaluationLog.findMany({
    where: {
      type: 'BRAIN_DUMP',
      created_at: {
        gte: new Date('2026-02-03T01:40:00.000Z'),
        lte: new Date('2026-02-03T01:50:00.000Z'),
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n10:40-10:50 JST 期間的 brain dump 日誌: ${timeLogs.length} 筆`);
  for (const log of timeLogs) {
    const input = log.input_content as any;
    console.log(`${log.created_at.toISOString()} - "${input?.text}"`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
