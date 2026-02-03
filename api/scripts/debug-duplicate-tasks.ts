import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 查詢重複的任務
  const tasks = await prisma.task.findMany({
    where: {
      content: { contains: 'Zentropy 架構可重用 App Repo 層' },
      deleted_at: null,
    },
    orderBy: { created_at: 'desc' },
    take: 5,
    include: {
      product: true,
    }
  });

  console.log('\n=== 重複任務 ===');
  for (const task of tasks) {
    console.log(`\nID: ${task.id}`);
    console.log(`標題: ${task.content}`);
    console.log(`創建時間: ${task.created_at}`);
    console.log(`Product: ${task.product.name}`);
    console.log(`Sub-items: ${JSON.stringify(task.sub_items, null, 2)}`);
    console.log(`AI Analysis: ${JSON.stringify(task.ai_analysis, null, 2)}`);
  }

  // 查詢最近的 brain dump 日誌
  const logs = await prisma.systemEvaluationLog.findMany({
    where: { type: 'BRAIN_DUMP' },
    orderBy: { created_at: 'desc' },
    take: 3,
  });

  console.log('\n\n=== 最近的 Brain Dump 日誌 ===');
  for (const log of logs) {
    console.log(`\n時間: ${log.created_at}`);
    console.log(`輸入: ${JSON.stringify(log.input_content)}`);
    console.log(`輸出: ${JSON.stringify(log.output_content, null, 2)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
