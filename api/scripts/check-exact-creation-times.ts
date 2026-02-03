import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      created_at: {
        gte: new Date('2026-02-03T01:45:00.000Z'),
        lte: new Date('2026-02-03T01:46:00.000Z'),
      },
      deleted_at: null,
    },
    select: {
      id: true,
      content: true,
      created_at: true,
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\n找到 ${tasks.length} 個任務:\n`);

  let prevTime: Date | null = null;
  for (const task of tasks) {
    const interval = prevTime
      ? task.created_at.getTime() - prevTime.getTime()
      : 0;

    console.log(`${task.created_at.toISOString()} (+${interval}ms) - ${task.content}`);
    prevTime = task.created_at;
  }

  // 分析時間間隔
  const intervals: number[] = [];
  for (let i = 1; i < tasks.length; i++) {
    const interval = tasks[i].created_at.getTime() - tasks[i - 1].created_at.getTime();
    intervals.push(interval);
  }

  if (intervals.length > 0) {
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const min = Math.min(...intervals);
    const max = Math.max(...intervals);

    console.log(`\n統計分析:`);
    console.log(`平均間隔: ${avg.toFixed(0)}ms`);
    console.log(`最小間隔: ${min}ms`);
    console.log(`最大間隔: ${max}ms`);

    if (avg < 2000 && intervals.every(i => i < 5000)) {
      console.log(`\n⚠️ 結論: 這些任務是在 ${Math.ceil((max - min) / 1000)} 秒內批量創建的，不是人工逐個輸入`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
