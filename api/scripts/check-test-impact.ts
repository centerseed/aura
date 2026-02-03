import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTestImpact() {
  try {
    // 檢查是否有測試用戶的痕跡
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'brain-dump-test' } },
          { email: { contains: 'test-brain-dump' } },
          { name: { contains: 'Brain Dump Test User' } }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        created_at: true,
        _count: {
          select: { tasks: true, products: true }
        }
      }
    });

    console.log('🔍 測試用戶查詢結果:\n');

    if (testUsers.length === 0) {
      console.log('❌ 未找到測試用戶（可能已被刪除）');
      console.log('   這意味著測試已經執行完畢並清理了測試資料\n');
    } else {
      console.log(`✅ 找到 ${testUsers.length} 個測試用戶:\n`);
      testUsers.forEach(u => {
        console.log(`   📧 ${u.email}`);
        console.log(`   👤 ${u.name}`);
        console.log(`   📅 建立時間: ${u.created_at}`);
        console.log(`   📊 Tasks: ${u._count.tasks}, Products: ${u._count.products}\n`);
      });
    }

    // 檢查資料庫中的實際狀況
    const totalUsers = await prisma.user.count({ where: { deleted_at: null } });
    const totalTasks = await prisma.task.count({ where: { deleted_at: null } });
    const totalProducts = await prisma.product.count({ where: { deleted_at: null } });
    const totalAreas = await prisma.area.count({ where: { deleted_at: null } });

    console.log('📊 資料庫總計:');
    console.log(`   Users: ${totalUsers}`);
    console.log(`   Tasks: ${totalTasks} ⚠️`);
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Areas: ${totalAreas}\n`);

    // 檢查是否有任何 Tasks 的歷史記錄（在 audit log 或其他地方）
    // 如果有 created_at 欄位，可以查看最近刪除的時間
    const recentDeletedTasks = await prisma.task.findMany({
      where: { deleted_at: { not: null } },
      orderBy: { deleted_at: 'desc' },
      take: 10,
      select: {
        id: true,
        content: true,
        deleted_at: true,
        user: { select: { email: true } }
      }
    });

    if (recentDeletedTasks.length > 0) {
      console.log('🗑️  最近軟刪除的 Tasks:');
      recentDeletedTasks.forEach(t => {
        console.log(`   ${t.content.substring(0, 40)}...`);
        console.log(`   User: ${t.user.email}`);
        console.log(`   刪除時間: ${t.deleted_at}\n`);
      });
    }

  } catch (error) {
    console.error('❌ 查詢失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestImpact();
