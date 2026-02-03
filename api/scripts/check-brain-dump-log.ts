/**
 * 查看最近的 brain-dump AI 輸出
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.systemEvaluationLog.findMany({
    where: { type: 'BRAIN_DUMP' },
    orderBy: { created_at: 'desc' },
    take: 3,
  });

  for (const log of logs) {
    console.log('\n========================================');
    console.log('時間:', log.created_at);
    console.log('輸入:', JSON.stringify((log.input_content as any)?.text, null, 2));
    console.log('\nAI 輸出:');
    const output = log.output_content as any;
    if (output?.items) {
      for (const item of output.items) {
        console.log('  ---');
        console.log('  title:', item.title);
        console.log('  inferred_from_milestone:', item.inferred_from_milestone || '(無)');
        console.log('  task_type:', item.task_type || '(無)');
        console.log('  estimated_days_needed:', item.estimated_days_needed || '(無)');
        console.log('  due_date:', item.due_date || '(無)');
        console.log('  due_date_source:', JSON.stringify(item.due_date_source, null, 4));
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
