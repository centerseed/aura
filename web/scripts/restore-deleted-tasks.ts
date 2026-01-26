/**
 * 恢復腳本: 還原被錯誤整合的 Tasks
 *
 * 使用方式:
 * tsx scripts/restore-deleted-tasks.ts <userId> <productId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreDeletedTasks(userId: string, productId: string) {
  console.log(`\n🔍 查找 Product ${productId} 下最近被刪除的 Tasks...\n`);

  // 查找最近 10 分鐘內被軟刪除的 tasks
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const deletedTasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      product_id: productId,
      deleted_at: {
        gte: tenMinutesAgo, // 只查找最近 10 分鐘內刪除的
      },
    },
    orderBy: {
      deleted_at: 'desc',
    },
  });

  if (deletedTasks.length === 0) {
    console.log('✅ 沒有找到最近被刪除的 Tasks');
    return;
  }

  console.log(`找到 ${deletedTasks.length} 個被刪除的 Tasks:\n`);
  deletedTasks.forEach((task, idx) => {
    console.log(`${idx + 1}. [${task.id}] ${task.content}`);
    console.log(`   刪除時間: ${task.deleted_at?.toLocaleString('zh-TW')}\n`);
  });

  // 恢復所有被刪除的 tasks
  const result = await prisma.task.updateMany({
    where: {
      id: { in: deletedTasks.map(t => t.id) },
    },
    data: {
      deleted_at: null,
    },
  });

  console.log(`\n✅ 成功恢復 ${result.count} 個 Tasks\n`);
}

// 從命令行參數獲取 userId 和 productId
const userId = process.argv[2];
const productId = process.argv[3];

if (!userId || !productId) {
  console.error('❌ 錯誤: 請提供 userId 和 productId');
  console.error('使用方式: tsx scripts/restore-deleted-tasks.ts <userId> <productId>');
  process.exit(1);
}

restoreDeletedTasks(userId, productId)
  .then(() => {
    console.log('✅ 完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 恢復失敗:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
