import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTasks() {
  try {
    // 檢查所有 Tasks（包括軟刪除的）
    const allTasks = await prisma.task.findMany({
      select: {
        id: true,
        content: true,
        deleted_at: true,
        created_at: true,
        user: {
          select: { email: true, name: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    const activeTasks = allTasks.filter(t => !t.deleted_at).length;
    const deletedTasks = allTasks.filter(t => t.deleted_at).length;

    console.log(`📊 Tasks 統計:`);
    console.log(`   總數: ${allTasks.length}`);
    console.log(`   ✅ 活躍: ${activeTasks}`);
    console.log(`   🗑️  軟刪除: ${deletedTasks}\n`);

    if (deletedTasks > 0) {
      console.log('⚠️  發現被軟刪除的 Tasks:\n');
      allTasks.filter(t => t.deleted_at).forEach(t => {
        const userInfo = t.user.email || t.user.name;
        console.log(`  🗑️  ${t.content.substring(0, 50)}...`);
        console.log(`      User: ${userInfo}`);
        console.log(`      刪除時間: ${t.deleted_at}\n`);
      });
    }

    // 檢查硬刪除的 Tasks（透過統計）
    const totalTasksCount = await prisma.task.count();
    console.log(`\n📈 Tasks 表總記錄數（含軟刪除）: ${totalTasksCount}`);

  } catch (error) {
    console.error('❌ 查詢失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTasks();
