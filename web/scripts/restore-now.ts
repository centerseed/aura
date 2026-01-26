import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = '467c7125-d890-429f-b46f-168429b1907e';
const productId = '4bc68ff0-599e-4411-aca5-27a589906940';

async function main() {
  console.log('\n🔍 查找最近被刪除的 Tasks...\n');

  // 查找最近 30 分鐘內被軟刪除的 tasks
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const deletedTasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      product_id: productId,
      deleted_at: {
        gte: thirtyMinutesAgo,
      },
    },
    orderBy: {
      deleted_at: 'desc',
    },
  });

  console.log(`找到 ${deletedTasks.length} 個被刪除的 Tasks:\n`);

  if (deletedTasks.length === 0) {
    console.log('✅ 沒有找到需要恢復的 Tasks');
    return;
  }

  deletedTasks.forEach((task, idx) => {
    console.log(`${idx + 1}. [${task.id.slice(0, 8)}...] ${task.content}`);
    console.log(`   刪除時間: ${task.deleted_at?.toLocaleString('zh-TW')}`);
  });

  console.log('\n📝 開始恢復...\n');

  // 恢復所有被刪除的 tasks
  const result = await prisma.task.updateMany({
    where: {
      id: { in: deletedTasks.map(t => t.id) },
    },
    data: {
      deleted_at: null,
      updated_at: new Date(),
    },
  });

  console.log(`✅ 成功恢復 ${result.count} 個 Tasks\n`);

  // 清理可能包含這些 tasks 的 parent task 的 sub_items
  console.log('🧹 清理 parent tasks 的 sub_items...\n');

  const parentTasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      product_id: productId,
      deleted_at: null,
      NOT: {
        sub_items: { equals: [] },
      },
    },
  });

  let cleanedCount = 0;
  const restoredTaskIds = new Set(deletedTasks.map(t => t.id));

  for (const parentTask of parentTasks) {
    const subItems = (parentTask.sub_items as Array<{
      id: string;
      original_task_id?: string;
      content: string;
    }>) || [];

    const filteredSubItems = subItems.filter(
      (item) => !restoredTaskIds.has(item.original_task_id || item.id)
    );

    if (filteredSubItems.length !== subItems.length) {
      await prisma.task.update({
        where: { id: parentTask.id },
        data: {
          sub_items: filteredSubItems,
          updated_at: new Date(),
        },
      });
      cleanedCount++;
      console.log(`   清理了 "${parentTask.content}" 的 sub_items`);
    }
  }

  if (cleanedCount > 0) {
    console.log(`\n✅ 清理了 ${cleanedCount} 個 parent tasks\n`);
  } else {
    console.log('\n✅ 沒有需要清理的 parent tasks\n');
  }

  console.log('🎉 恢復完成！\n');
}

main()
  .catch((e) => {
    console.error('❌ 錯誤:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
