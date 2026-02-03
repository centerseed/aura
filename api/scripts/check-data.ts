import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  try {
    // 檢查所有用戶（包括軟刪除的）
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, deleted_at: true },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    const activeUsers = allUsers.filter(u => !u.deleted_at).length;
    const deletedUsers = allUsers.filter(u => u.deleted_at).length;

    console.log(`📊 總用戶數: ${allUsers.length}`);
    console.log(`✅ 活躍用戶: ${activeUsers}`);
    console.log(`🗑️  軟刪除用戶: ${deletedUsers}`);

    if (allUsers.length > 0) {
      console.log('\n最近 10 位用戶:');
      allUsers.forEach(u => {
        const status = u.deleted_at ? '🗑️ (已刪除)' : '✅';
        const email = u.email || 'No email';
        const name = u.name || 'No name';
        console.log(`  ${status} ${email} - ${name}`);
      });
    }

  } catch (error) {
    console.error('❌ 查詢失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
