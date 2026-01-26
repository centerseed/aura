import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = '467c7125-d890-429f-b46f-168429b1907e';
const productId = '4bc68ff0-599e-4411-aca5-27a589906940';

async function main() {
  console.log('\n🔍 查找最近被刪除的 Tasks（包含 references）...\n');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const deletedTasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      product_id: productId,
      deleted_at: {
        gte: oneHourAgo,
      },
    },
    orderBy: {
      deleted_at: 'desc',
    },
  });

  console.log(`找到 ${deletedTasks.length} 個被刪除的 Tasks\n`);

  if (deletedTasks.length === 0) {
    console.log('✅ 沒有需要恢復的 Tasks');
    return;
  }

  // 顯示所有被刪除的 tasks 及其 references
  for (const task of deletedTasks) {
    const references = task.references as Array<{ id: string; type: string; content: string; title?: string }> || [];
    console.log(`📝 ${task.content}`);
    console.log(`   ID: ${task.id.slice(0, 8)}...`);
    console.log(`   刪除時間: ${task.deleted_at?.toLocaleString('zh-TW')}`);
    if (references.length > 0) {
      console.log(`   📎 有 ${references.length} 個 references`);
    }
  }

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

  console.log(`✅ 成功恢復 ${result.count} 個 Tasks（包含它們的 references）\n`);

  // 顯示恢復後的統計
  const tasksWithRefs = deletedTasks.filter(t => {
    const refs = t.references as Array<any> || [];
    return refs.length > 0;
  });

  if (tasksWithRefs.length > 0) {
    console.log(`📎 其中 ${tasksWithRefs.length} 個 Tasks 包含 references:`);
    for (const task of tasksWithRefs) {
      const references = task.references as Array<{ id: string; type: string; content: string; title?: string }> || [];
      console.log(`   - ${task.content}: ${references.length} 個 references`);
    }
  }

  console.log('\n🎉 恢復完成！\n');
}

main()
  .catch((e) => {
    console.error('❌ 錯誤:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
