import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = '467c7125-d890-429f-b46f-168429b1907e';
const productId = '4bc68ff0-599e-4411-aca5-27a589906940';

async function main() {
  console.log('\n🔍 檢查最近被刪除的 Tasks 的 references...\n');

  // 查找最近 1 小時內被軟刪除的 tasks（包含它們的 references）
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

  console.log(`找到 ${deletedTasks.length} 個被刪除的 Tasks:\n`);

  for (const task of deletedTasks) {
    const references = task.references as Array<{ id: string; type: string; content: string; title?: string }> || [];

    console.log(`\n📝 Task: ${task.content}`);
    console.log(`   ID: ${task.id.slice(0, 8)}...`);
    console.log(`   刪除時間: ${task.deleted_at?.toLocaleString('zh-TW')}`);

    if (references.length > 0) {
      console.log(`   📎 References (${references.length} 個):`);
      references.forEach((ref, idx) => {
        console.log(`      ${idx + 1}. [${ref.type}] ${ref.content.slice(0, 60)}${ref.content.length > 60 ? '...' : ''}`);
      });
    } else {
      console.log(`   ⚠️  沒有 references`);
    }
  }

  // 檢查是否有現存的 task 可以接收這些 references
  console.log('\n\n🔍 檢查現存的相關 tasks...\n');

  const activeTasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      product_id: productId,
      deleted_at: null,
      content: {
        contains: '樂天',
      },
    },
  });

  console.log(`找到 ${activeTasks.length} 個包含「樂天」的現存 tasks:\n`);

  for (const task of activeTasks) {
    const references = task.references as Array<{ id: string; type: string; content: string; title?: string }> || [];

    console.log(`\n📝 Task: ${task.content}`);
    console.log(`   ID: ${task.id.slice(0, 8)}...`);

    if (references.length > 0) {
      console.log(`   📎 References (${references.length} 個):`);
      references.forEach((ref, idx) => {
        console.log(`      ${idx + 1}. [${ref.type}] ${ref.content.slice(0, 60)}${ref.content.length > 60 ? '...' : ''}`);
      });
    } else {
      console.log(`   ⚠️  沒有 references`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ 錯誤:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
